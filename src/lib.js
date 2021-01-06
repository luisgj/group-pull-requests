import { context } from '@actions/github';

/**
 * createComment
 * @description Create a comment in the current PR 
 * @param {octokit} octokit 
 * @param {string} pull 
 * @param {string} message 
 */
export const createComment = async function(octokit, pull, message) {
    try {
        await octokit.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pull,
            body: message,
          });
    } catch(e) {
        console.log('Error creating comment')
        console.log(e.message);
    }
};

/**
 * cleanup
 * @description Cleanup after the step runs.
 * @param {*} octokit 
 * @param {string} tempBranch 
 */
export const cleanup = async function(octokit, tempBranch) {
    try {
        console.log(`Deleting temp branch: ${tempBranch}`);
        await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
            owner: context.repo.owner,
            repo: context.repo.repo,
            ref: `heads/${tempBranch}`,
        });
    } catch(e) {
        console.log('Error deleting temp branch.')
        console.log(e.message);
    }
};

/**
 * createLabel
 * @description 
 * @param {*} octokit 
 * @param {*} label 
 */
export const createLabel = async function(octokit, label) {

};

