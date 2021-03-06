import { context, getOctokit } from '@actions/github';
import { getInput, setFailed, setOutput } from '@actions/core';
import { createComment, cleanup } from './lib';

/**
 * groupLabeledPullRequests
 * @description Fetches all PRs from repo with target label and merge each one to a temp branch.
 * @arg {object} octokit Github Octokit Rest client
 */
export const groupLabeledPullRequests = async function (octokit) {
    //get current pull request number
    const splitUrl = context.payload.comment.issue_url.split('/');
    const currentIssueNumber = parseInt(splitUrl[splitUrl.length - 1], 10)
    //create tempBranchName
    const tempBranch = `temp-ci-${context.repo.repo}-${Date.now()}`;
    try {
        //get input from Github Job declaration
        var pulls = [];
        var comment = '### Going to merge pull requests:\n';
        var prLinks = '';
        const label = getInput('target-label');
        const excludeCurrent = getInput('exclude-current');
        //Create search query
        const q = `is:pull-request label:${label} repo:${context.repo.owner}/${context.repo.repo} state:open`;
        //Call github API through the octokit client
        const { data } = await octokit.search.issuesAndPullRequests({
            q,
            sort: 'created',
            order: 'desc',
        });
        //Exclude the current branch, so we will build the default.
        if(excludeCurrent === "true" && data.total_count <= 0) {
            return "default";
        }
        //Fetch the current pull request
        const { data: currentPull } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: currentIssueNumber
        });
        // Nothing to iterate. Just add the current pull data to merge
        if(excludeCurrent !== 'true' && data.total_count <= 0) {
            prLinks += `- ${currentPull.html_url}\n`;
            comment += prLinks;
            await createComment(octokit, currentIssueNumber, comment);
            await mergeBranches(octokit, [currentPull], tempBranch);
            //comment success in PR if merge is successful.
            await createComment(
                octokit,
                currentIssueNumber,
                `:rocket: All pull requests were merged successfully from \`${tempBranch}\` into \`${getInput('integration-branch')}\`.\n\n**Summary:**\n---\n${prLinks}:`,
            );
            await cleanup(octokit, tempBranch);
            setOutput('temp-branch', tempBranch);
            return;
        }
        //iterate over selected PRs
        if(data.total_count > 0) {
            if(excludeCurrent !== 'true') {
                console.log('Pushing current PR to array');
                prLinks += `- ${currentPull.html_url}\n`;
                pulls.push(currentPull);
            }
            for (const item of data.items) {
                if (item.number !== currentIssueNumber) {
                    const accPull = await octokit.request(`GET /repos/{owner}/{repo}/pulls/{pull_number}`, {
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        pull_number: item.number
                    });
                    console.log(`Pushing External PR #${item.number} to array`);
                    prLinks += `- ${item.html_url}\n`;
                    pulls.push(accPull.data);
                }
            }
        }
        //comment and merge branches
        comment += prLinks;
        await createComment(octokit, currentIssueNumber, comment);
        await mergeBranches(octokit, pulls, tempBranch);
        //comment success in PR if merge is successful.
        await createComment(
            octokit,
            currentIssueNumber,
            `:rocket: All pull requests were merged successfully from \`${tempBranch}\` into \`${getInput('integration-branch')}\`.\n\n**Summary:**\n---\n${prLinks}`,
        );
        //cleanup function (delete temp branch)
        await cleanup(octokit, tempBranch);
        setOutput('temp-branch', tempBranch);
    } catch (e) {
        if (e.message === "Merge conflict") {
            console.log("Merge conflict error.")
            //Add label
        }
        //comment failure in pr, cleanup and set action as failed.
        const message = `:ghost: Merge failed with error:\n\`\`\`shell\n${e.message}\n\`\`\``;
        await createComment(octokit, currentIssueNumber, message);
        await cleanup(octokit, tempBranch);
        setFailed(e.message);
    }
};

/**
 * mergeBranches
 * @description Merge the the head branches in a PR array into a temp branch.
 * @arg {array} pulls Array of pullr request objects.
 * @arg {object} octokit Github Octokit Rest client.
 * @arg {string} tempBranch Temporal branch to merge the grouped heads.
 */
const mergeBranches = async function (octokit, pulls, tempBranch) {
    //get client with permissions to merge
    const token = getInput('private-token');
    const octokitMerge = getOctokit(token);
    //get latest main branch sha.
    const mainBranchName = getInput('main-branch');
    const integrationBranchName = getInput('integration-branch');
    const { data: { commit: { sha } } } = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: mainBranchName
    });
    console.log(`Creating branch ${tempBranch} from main with sha: ${sha}.`);
    //create temp branch from main branch.
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `refs/heads/${tempBranch}`,
        sha: sha,
    });
    //merge group branches to tmp branch
    for (const pull of pulls) {
        console.log(`Merging Pull Request #${pull.number} into ${tempBranch}`);
        await octokit.request('POST /repos/{owner}/{repo}/merges', {
            owner: context.repo.owner,
            repo: context.repo.repo,
            base: tempBranch,
            head: pull.head.ref,
        });
        console.log(`Merged Pull Request #${number} into ${tempBranch} successfully.`);
    }
    //get latest temp branch commit sha
    const { data: { commit: { sha: tempSha } } } = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: tempBranch
    });
    console.log(`Updating branch ${integrationBranchName} from ${tempBranch} with commit sha: ${tempSha}.`);
    await octokitMerge.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `heads/${integrationBranchName}`,
        sha: tempSha,
        force: true,
    });
};
