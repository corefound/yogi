import { Status } from "./status"
import { maxRetries } from "./config"
import { addWeight, hasEnoughScore } from "./scoring"

function createAuditWeight(input: number, weight: number): number {
    let total: number = input + weight
    return total
}

let retryCount: number = 0
let externalPayload: any = 10
let status: Status = undefined

let hasRetries: boolean = retryCount < maxRetries
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
