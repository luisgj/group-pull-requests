# Group Pull Requests Github Action

A Javascript Github Action that fetches open pull requests with a specific label and returns the grouped source branches.

## Inputs

### `target-label`

**Required** The label that all Pull Requests must contain to be grouped.

### `repo-token`

**Required** The token secret stored in `secrets.GITHUB_TOKEN`

### `main-branch`

**Required** Main branch of the repo

### `integration-branch`

**Required** A protected branch that serves as integration to a testing environment

## Outputs

### `temp-branch`

Temp branch name with the grouped heads merged in.

## Example usage

```yaml
uses: bitsoex/group-and-merge-action@v1.0
with:
  target-label: 'stage-ready'
  repo-token: '${{ secrets.GITHUB_TOKEN }}'
  integration-branch: 'staging'
  main-branch: 'main'
```
