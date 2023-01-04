import * as github from '@actions/github'
import { paginateGraphql } from '@octokit/plugin-paginate-graphql'

type RateLimit = {
  cost: number,
  remaining: number
}

type OrgRepos = {
  organization: {
    repositories: {
      edges: {
        repository: {
          id: string
          name: string
        }
      }[]
    }
  }
}

type RepoBranches = {
  repository: {
    refs: {
      edges: {
        node: {
          id: string
          name: string
        }
      }[]
    }
  }
}

type BranchCommits = {
  repository: {
    ref: {
      target: {
        history: {
          nodes: {
            oid: string // = git commit hash
            author: {
              user: {
                login: string
              }
            }
          }[]
        }
      }
    }
  }
}

export class GithubApi {

  octokit: ReturnType<typeof github.getOctokit> & ReturnType<typeof paginateGraphql>

  constructor(token: string) {
    this.octokit = github.getOctokit(token, { baseUrl: process.env['GITHUB_API_URL'] }, paginateGraphql) as typeof this.octokit
  }

  async getRateLimit(): Promise<RateLimit> {
    return this.octokit.graphql(`
      query { 
        rateLimit {
          cost
          remaining
        }
      }
    `)
  }

  async getOrgRepos(organization: string) {
    const result = await this.octokit.graphql.paginate<OrgRepos>(
      `query paginate($cursor: String, $organization: String!) {
        organization(login: $organization) {
          repositories(first: 100, after: $cursor) {
            edges {
              repository:node {
                id
                name
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
        organization,
      }
    )
    return result.organization.repositories.edges.map(e => ({
      id: e.repository.id,
      name: e.repository.name
    }))
  }

  async getRepoBranches(repoId: string) {
    const result = await this.octokit.graphql.paginate<RepoBranches>(
      `query paginate($cursor: String, $repoId: String!) {
        node(id: $repoId) {
          ... on Repository {
            refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }`,
      {
        repoId
      }
    )
    return result.repository.refs.edges.map(e => ({
      id: e.node.id,
      name: e.node.name
    }))
  }


  async getBranchCommits(branchId: string, since: string) {
    const result = await this.octokit.graphql.paginate<BranchCommits>(
      `query paginate($cursor: String, $branchId: String!, $since: String!) {
        node(id: $branchId) {
          ... on Ref {
            target {
              ... on Commit {
                history(first:100, since: $since, after: $cursor) {
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
                }
              }
            }
          }
        }
      }`,
      {
        branchId,
        since
      }
    )
    return result.repository.ref.target.history.nodes.map(n => ({
      author: n.author.user.login,
      oid: n.oid
    }))
  }
}