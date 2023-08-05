# user-activity-report
Create a User Activity Report for your Github organization. The action uses the Github GraphQL API and depending on the size of your organization will fetch a lot of data.

If you get an error because you reach the hourly rate limit of 5000 points you can either reduce the report time frame (`since-days` or `since` and `until`) or play with the other inputs. Comments cost a lot of points so you might want to disable them if not needed.

The action only fetches nested information on objects that have updates since `since-days`. So the total rate limit cost varies depending on the created/updated objects in the time window. It is printed at the end of the action and can be seen in the workflow logs.

💡 By default only the commits on the default branch are analyzed because usually the activity on other branches ends up in pull requests. You can set `analyze-commits-on-all-branches` to `true` to count commits on all branches.


## Usage:
```yaml
name: 'User Activity Report'
on:
  workflow_dispatch:
  
jobs:
  'create-report':
    runs-on: ubuntu-latest
    steps:
      - uses: sorekz/user-activity-report@v1
        with:
          token: ${{ secrets.TOKEN }}
          organization: 'your-org'
```


## Example report
You can see the report in the action run summary. Users are sorted by *Org member*, *Active*, an Activity Score with the most active users are listed on top.

| User | Org member | Active | Commits | Created Issues | Issue Comments | Created PRs | Merged PRs | PR Comments | Created Discussions | Discussion Comments |
|---|---|---|---|---|---|---|---|---|---|---|
| sorekz | ✔️ | ✔️ | 8 | 2 | 2 | 1 | 1 | 1 | 1 | 2 |
| daniel | ✔️ | ❌ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| dependabot | ❌ | ✔️ | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 |

## Example CSV and JSON reports
You can enable the option to write the report as csv and/or json output and use the actions/upload-artifact action to upload them. The zip file containing both reports can be downloaded afterwards in the action run.
```yaml
name: 'User Activity Report'
on:
  workflow_dispatch:
  
jobs:
  'create-report':
    runs-on: ubuntu-latest
    steps:
      - uses: sorekz/user-activity-report@v1
        with:
          token: ${{ secrets.TOKEN }}
          organization: 'your-org'
          create-json: data.json
          create-csv: data.csv
      - uses: actions/upload-artifact@v3
        with:
          name: reports
          path: |
            data.json
            data.csv
```

## Example to get monthly reports
By passing the `since` and `until` parameters it's possible to generate monthly reports, or for any other time frames. Be aware that the [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) value `2023-08` is equal to the first millisecond on 1st August and that the `until` parameter is exclusive. 

The example creates a report for activities between `2023-07-01T00:00:00.000Z` and `2023-07-31T23:59:59.999Z`


```yaml
name: 'User Activity Report'
on:
  workflow_dispatch:
  
jobs:
  'create-report':
    runs-on: ubuntu-latest
    steps:
      - uses: sorekz/user-activity-report@v1
        with:
          token: ${{ secrets.TOKEN }}
          organization: 'your-org'
          since: 2023-07
          until: 2023-08
```

## Example to get a report for the last month
By passing the `since` and `until` parameters in combination with the [`actions/github-script`](https://github.com/) action it's possible to generate reports for the previous month. If this workflow is run on 2023-08-05 it will return results equal to `since: 2023-07` and `until: 2023-08`.


```yaml
name: 'User Activity Report'
on:
  workflow_dispatch:
  
jobs:
  'create-report':
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        id: since-date
        with:
          script: return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) 
          result-encoding: string
      - uses: actions/github-script@v6
        id: until-date
        with:
          script: return new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
          result-encoding: string
      - uses: sorekz/user-activity-report@v1
        with:
          token: ${{ secrets.TOKEN }}
          organization: 'your-org'
          since: ${{ steps.since-date.outputs.result }}
          until: ${{ steps.until-date.outputs.result }}
```

## Inputs
### token
**Required** Github access token for the organization. Required permissions are `repo`, `read:org`

### organization
**Required** The organization to create the report for

### since-days
The number of days in the past to search for activity for. One day is relative to the start time and equal to 24 hours.\
If the parameter `since` has a value, this parameter is ignored.\
default: `90`

### since
The [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) since date. `2023-12` is equal to `2023-12-01T00:00:00.000Z`

### until
The [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) until date. This value is exclusive. E.g. `2024-01` will include results until `2023-12-31T23:59:59.999Z`.\
If the parameter `since` has a value and this parameter has no value, it will default to `now`.\

### analyze-commits
Enable to analyze commits\
default: `true`

### analyze-commits-on-all-branches
Enable to analyze commits on all branches. By default only commits on the default branches are analyzed. Ignored if `analyze-commits` is `false`\
default: `false`

### analyze-issues
Enable to analyze issues\
default: `true`

### analyze-issue-comments
Enable to analyze issue comments\
default: `true`

### analyze-pull-requests
Enable to analyze pull requests\
default: `true`

### analyze-pull-request-comments
Enable to analyze pull requests comments\
default: `true`

### analyze-discussions
Enable to analyze discussions\
default: `true`

### analyze-discussion-comments
Enable to analyze discussions comments\
default: `true`

### create-json
Save the report as json file to this path

### create-csv
Save the report as csv file to this path

### create-summary
Write the report as step summary to the github action\
default: `true`

## Need to know
- Commits are only counted once. If you have `analyze-commits-on-all-branches` enabled then a commit that is part of multiple branches is only counted once. If you use merge commits a new commit with a new git ref is created and counted.
- Commits that have been authored but not committed within the report time frame are not counted. The commit date is relevant.
- A merged pull request is counted both in *Created PRs* and *Merged PRs* if it was created and merged within the report time frame

## Rate limit cost
The cost is nested so you can multiply each indention and sum it up. It is approximately:
- 1 per 100 organization members
- 1 per 100 repositories
  - 1 per 100 branches in each repository
    - 1 per 100 commits within the report time frame in each branch
  - 1 per 100 issues created/updated `since-days` or `since` in each repository
    - 1 per 100 issue comments in each issue
  - 1 per 100 pull requests in each repository
    - 1 per 100 pull request comments in each pull request
  - 1 per 100 discussions in each repository
    - 1 per 100 discussion comments in each pull request

Because the pull requests and discussions can not be queried based on a timestamp the action always fetches all comments, but filters comments only for the objects that have updates (including added comments) since `since-days` or `since`.

## Limitations
- Discussions can currently not be analyzed on GHES because the graphQL schema is missing fields compared to the schema on Github.com

---

This action was inspired by Peter Murray's https://github.com/peter-murray/inactive-users-action
