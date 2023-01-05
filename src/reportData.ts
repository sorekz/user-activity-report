type ReportUserData = {
    isOrgMember: boolean
    isActive: boolean
    commits: number
    createdIssues: number
    issueComments: number
    createdPrs: number
    mergedPrs: number
    prComments: number
    createdDiscussions: number
    discussionComments: number
}

export type AnalyzeOptions = {
    commits: boolean
    commitsOnAllBranches: boolean
    issues: boolean
    issueComments: boolean
    pullRequests: boolean
    pullRequestComments: boolean
    discussions: boolean
    discussionComments: boolean
}

export class ReportData {

    constructor(private organization: string, private analyzeOptions?: AnalyzeOptions, private report: { [userName: string]: ReportUserData } = {}) { }

    getOrCreateUserData(userName: string): ReportUserData {
        let userData: ReportUserData | undefined = this.report[userName]
        if (!userData) {
            userData = {
                isOrgMember: false,
                isActive: false,
                commits: 0,
                createdIssues: 0,
                issueComments: 0,
                createdPrs: 0,
                mergedPrs: 0,
                prComments: 0,
                createdDiscussions: 0,
                discussionComments: 0
            }
            this.report[userName] = userData
        }
        return userData
    }


    setOrgMember(userName: string): void {
        this.getOrCreateUserData(userName).isOrgMember = true
    }

    setActive(userName: string): void {
        this.getOrCreateUserData(userName).isActive = true
    }

    addCommit(userName: string): void {
        this.getOrCreateUserData(userName).commits++
        this.setActive(userName)
    }

    addCreatedIssue(userName: string): void {
        this.getOrCreateUserData(userName).createdIssues++
        this.setActive(userName)
    }

    addIssueComment(userName: string): void {
        this.getOrCreateUserData(userName).issueComments++
        this.setActive(userName)
    }

    addCreatedPr(userName: string): void {
        this.getOrCreateUserData(userName).createdPrs++
        this.setActive(userName)
    }

    addMergedPr(userName: string): void {
        this.getOrCreateUserData(userName).mergedPrs++
        this.setActive(userName)
    }

    addPrComment(userName: string): void {
        this.getOrCreateUserData(userName).prComments++
        this.setActive(userName)
    }

    addCreatedDiscussion(userName: string): void {
        this.getOrCreateUserData(userName).createdDiscussions++
        this.setActive(userName)
    }

    addDiscussionComment(userName: string): void {
        this.getOrCreateUserData(userName).discussionComments++
        this.setActive(userName)
    }

    toJSON(): string {
        return JSON.stringify(this.report, null, 2)
    }

    toMarkdown(): string {
        let buffer = ''
        let numColumns = 0
        buffer += `# User Activity Report for ${this.organization}\n`
        buffer += '\n'
        buffer += '| User | Org member | Active '
        numColumns += 3
        if (this.analyzeOptions?.commits) {
            buffer += '| Commits '
            numColumns += 1
        }
        if (this.analyzeOptions?.issues) {
            buffer += '| Created Issues '
            numColumns += 1
        }
        if (this.analyzeOptions?.issueComments) {
            buffer += '| Issue Comments '
            numColumns += 1
        }
        if (this.analyzeOptions?.pullRequests) {
            buffer += '| Created PRs | Merged PRs '
            numColumns += 2
        }
        if (this.analyzeOptions?.pullRequestComments) {
            buffer += '| PR Comments '
            numColumns += 1
        }
        if (this.analyzeOptions?.discussions) {
            buffer += '| Created Discussions '
            numColumns += 1
        }
        if (this.analyzeOptions?.discussionComments) {
            buffer += '| Discussion Comments '
            numColumns += 1
        }
        buffer += '|\n'
        buffer += `${'|---'.repeat(numColumns)}|\n`
        for (const [username, data] of Object.entries(this.report)) {
            buffer += `| ${username} | ${data.isOrgMember ? '✔️' : '❌'} | ${data.isActive ? '✔️' : '❌'} `
            if (this.analyzeOptions?.commits) {
                buffer += `| ${data.commits} `
            }
            if (this.analyzeOptions?.issues) {
                buffer += `| ${data.createdIssues} `
            }
            if (this.analyzeOptions?.issueComments) {
                buffer += `| ${data.issueComments} `
            }
            if (this.analyzeOptions?.pullRequests) {
                buffer += `| ${data.createdPrs} | ${data.mergedPrs} `
            }
            if (this.analyzeOptions?.pullRequestComments) {
                buffer += `| ${data.prComments} `
            }
            if (this.analyzeOptions?.discussions) {
                buffer += `| ${data.createdDiscussions} `
            }
            if (this.analyzeOptions?.discussionComments) {
                buffer += `| ${data.discussionComments} `
            }
            buffer += '|\n'
        }
        return buffer
    }

    toCSV(): string {
        let buffer = ''
        buffer += 'User,Org member,Active'
        if (this.analyzeOptions?.commits) {
            buffer += ',Commits'
        }
        if (this.analyzeOptions?.issues) {
            buffer += ',Created Issues'
        }
        if (this.analyzeOptions?.issueComments) {
            buffer += ',Issue Comments'
        }
        if (this.analyzeOptions?.pullRequests) {
            buffer += ',Created PRs,Merged PRs'
        }
        if (this.analyzeOptions?.pullRequestComments) {
            buffer += ',PR Comments'
        }
        if (this.analyzeOptions?.discussions) {
            buffer += ',Created Discussions'
        }
        if (this.analyzeOptions?.discussionComments) {
            buffer += ',Discussion Comments'
        }
        buffer += '\n'
        for (const [username, data] of Object.entries(this.report)) {
            buffer += `${username},${data.isOrgMember ? '1' : '0'},${data.isActive ? '1' : '0'}`
            if (this.analyzeOptions?.commits) {
                buffer += `,${data.commits}`
            }
            if (this.analyzeOptions?.issues) {
                buffer += `,${data.createdIssues}`
            }
            if (this.analyzeOptions?.issueComments) {
                buffer += `,${data.issueComments}`
            }
            if (this.analyzeOptions?.pullRequests) {
                buffer += `,${data.createdPrs},${data.mergedPrs}`
            }
            if (this.analyzeOptions?.pullRequestComments) {
                buffer += `,${data.prComments}`
            }
            if (this.analyzeOptions?.discussions) {
                buffer += `,${data.createdDiscussions}`
            }
            if (this.analyzeOptions?.discussionComments) {
                buffer += `,${data.discussionComments}`
            }
            buffer += '\n'
        }
        return buffer
    }
}