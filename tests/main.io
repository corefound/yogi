type Status = string | undefined

function addWeight(input: number, weight: number): number {
    let total: number = input + weight
    return total
}

const maxScore: number = 100
const minDeployScore: number = 70
let rawScore: number = 48
let testCoverage: number = 24
let crashPenalty: number = 6
let retryCount: number = 0
let externalPayload: any = 10
let status: Status = undefined

let weightedScore: number = rawScore + testCoverage
weightedScore = weightedScore - crashPenalty

let scorePercent: number = weightedScore * maxScore / 100
let hasEnoughScore: boolean = scorePercent >= minDeployScore
let hasRetries: boolean = retryCount < 3
let canDeploy: boolean = hasEnoughScore && hasRetries

if (canDeploy) {
    status = "release-candidate"
    retryCount = retryCount + 1

    let auditLabel: Status = "automated-check"

    if (auditLabel !== undefined) {
        let auditPassed: boolean = true
    }
}

if (status === undefined) {
    status = "manual-review"
    retryCount = retryCount + 1
}
