import * as github from '@actions/github'
import { paginateGraphql } from '@octokit/plugin-paginate-graphql'

const IS_GITHUB_COM = process.env['GITHUB_API_URL'] === 'https://api.github.com'

export class GithubApi {
  octokit: ReturnType<typeof github.getOctokit> & ReturnType<typeof paginateGraphql>

  constructor(token: string) {
    this.octokit = github.getOctokit(token, { baseUrl: process.env['GITHUB_API_URL'] }, paginateGraphql) as typeof this.octokit
  }

  async getRateLimitRemaining(): Promise<number> {
    const result = await this.octokit.graphql<{
      rateLimit?: { // rate limit might be disabled on GHES
        remaining: number
      }
    }>(
      `query {
        rateLimit {
          remaining
        }
      }`
    )
    return result.rateLimit?.remaining || 5000
  }

  async getOrgMembers(organization: string): Promise<string[]> {
    const result = await this.octokit.graphql.paginate<{
      organization: {
        membersWithRole: {
          nodes: {
            login: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $organization: String!) {
        organization(login: $organization) {
          membersWithRole(first: 100, after: $cursor) {
            nodes {
              login
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
      {
        organization
      }
    )
    return result.organization.membersWithRole.nodes.map(n => n.login)
  }

  async getOrgRepos(organization: string): Promise<{
    id: string,
    name: string,
    hasDiscussionsEnabled: boolean,
    hasIssuesEnabled: boolean
  }[]> {
    const result = await this.octokit.graphql.paginate<{
      organization: {
        repositories: {
          edges: {
            repository: {
              id: string
              name: string
              hasDiscussionsEnabled?: boolean
              hasIssuesEnabled: boolean
            }
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $organization: String!) {
        organization(login: $organization) {
          repositories(first: 100, after: $cursor) {
            edges {
              repository:node {
                id
                name
                ${IS_GITHUB_COM ? 'hasDiscussionsEnabled' : ''}
                hasIssuesEnabled
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
      {
        organization
      }
    )
    return result.organization.repositories.edges.map(e => ({
      ...e.repository,
      hasDiscussionsEnabled: e.repository.hasDiscussionsEnabled || false
    }))
  }

  async getRepoBranches(repoId: string): Promise<{ id: string, name: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        refs: {
          nodes: {
            id: string
            name: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $repoId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
              nodes {
                id
                name
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        repoId
      }
    )
    return result.node.refs.nodes
  }

  async getRepoDefaultBranch(repoId: string): Promise<{ id: string, name: string }> {
    const result = await this.octokit.graphql<{
      node: {
        defaultBranchRef: {
          id: string
          name: string
        }
      }
    }>(
      `query paginate($repoId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            defaultBranchRef {
              id
              name
            }
          }
        }
      }`,
      {
        repoId
      }
    )
    return result.node.defaultBranchRef
  }

  async getBranchCommits(branchId: string, since: string, until: string): Promise<{
    author?: string
    oid: string
  }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        target: {
          history: {
            nodes: {
              oid: string // = git commit hash
              author: {
                user?: {
                  login: string
                }
              }
            }[]
          }
        }
      }
    }>(
      `query paginate($cursor: String, $branchId: ID!, $since: GitTimestamp!, $until: GitTimestamp!) {
        node(id: $branchId) {
          ... on Ref {
            target {
              ... on Commit {
                history(first: 100, since: $since, until: $until, after: $cursor) {
                  nodes {
                    ... on Commit {
                      oid
                      author {
                        user {
                          login
                        }
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          }
        }
      }`,
      {
        branchId,
        since,
        until
      }
    )
    return result.node.target.history.nodes.map(n => ({
      author: n.author.user?.login,
      oid: n.oid
    }))
  }

  async getRepoIssues(repoId: string, since: string): Promise<{ id: string, number: number, author?: string, createdAt: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        issues: {
          nodes: {
            id: string
            number: number,
            author?: {
              login: string
            }
            createdAt: string
          }[]
        }
      }
    }>(
      // filterBy since includes issues that have been created/edited/changed(assigned to)/commented on
      // interactions that don't update the issue: reactions, probably projects
      `query paginate($cursor: String, $repoId: ID!, $since: DateTime) {
        node(id: $repoId) {
          ... on Repository {
            issues(first: 100, filterBy: {since: $since}, after: $cursor) {
              nodes {
                id
                number
                author {
                  login
                }
                createdAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        repoId,
        since
      }
    )
    return result.node.issues.nodes.map(n => ({ id: n.id, number: n.number, author: n.author?.login, createdAt: n.createdAt }))
  }

  async getIssueComments(issueId: string): Promise<{ createdAt: string, author?: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        comments: {
          nodes: {
            createdAt: string
            author?: {
              login: string
            }
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $issueId: ID!) {
        node(id: $issueId) {
          ... on Issue {
            comments(first: 100, after: $cursor) {
              nodes {
                createdAt
                author {
                  login
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        issueId
      }
    )
    return result.node.comments.nodes.map(n => ({ createdAt: n.createdAt, author: n.author?.login }))
  }

  async getRepoPullRequests(repoId: string): Promise<{ id: string, number: number, author?: string, createdAt: string, updatedAt: string, mergedBy?: string, mergedAt?: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        pullRequests: {
          nodes: {
            id: string
            number: number
            author?: {
              login: string
            }
            createdAt: string
            updatedAt: string
            mergedBy?: {
              login: string
            }
            mergedAt?: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $repoId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            pullRequests(first: 100, after: $cursor) {
              nodes {
                id
                number
                author {
                  login
                }
                createdAt
                mergedBy {
                  login
                }
                mergedAt
                updatedAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        repoId
      }
    )
    return result.node.pullRequests.nodes.map(n => ({
      id: n.id, author: n.author?.login, number: n.number, createdAt: n.createdAt, updatedAt: n.updatedAt, mergedAt: n.mergedAt, mergedBy: n.mergedBy?.login
    }))
  }

  async getRepoPullComments(prId: string): Promise<{ author?: string, createdAt: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        comments: {
          nodes: {
            author?: {
              login: string
            }
            createdAt: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $prId: ID!) {
        node(id: $prId) {
          ... on PullRequest {
            comments(first: 100, after: $cursor) {
              nodes {
                author {
                  login
                }
                createdAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        prId
      }
    )
    return result.node.comments.nodes.map(n => ({ author: n.author?.login, createdAt: n.createdAt }))
  }

  async getRepoDiscussions(repoId: string): Promise<{ id: string, number: number, author?: string, createdAt: string, updatedAt: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        discussions: {
          nodes: {
            id: string
            number: number
            author?: {
              login: string
            }
            createdAt: string
            updatedAt: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $repoId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            discussions(first: 100, after: $cursor) {
              nodes {
                id
                number
                author {
                  login
                }
                createdAt
                updatedAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        repoId
      }
    )
    return result.node.discussions.nodes.map(n => ({ id: n.id, number: n.number, author: n.author?.login, createdAt: n.createdAt, updatedAt: n.updatedAt }))
  }

  async getDiscussionComments(prId: string): Promise<{ author?: string, createdAt: string }[]> {
    const result = await this.octokit.graphql.paginate<{
      node: {
        comments: {
          nodes: {
            author?: {
              login: string
            }
            createdAt: string
          }[]
        }
      }
    }>(
      `query paginate($cursor: String, $prId: ID!) {
        node(id: $prId) {
          ... on Discussion {
            comments(first: 100, after: $cursor) {
              nodes {
                author {
                  login
                }
                createdAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        prId
      }
    )
    return result.node.comments.nodes.map(n => ({ author: n.author?.login, createdAt: n.createdAt }))
  }
}
