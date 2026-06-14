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
let cachedOwner: string | undefined = undefined
let owner: string = cachedOwner ?? "platform"
cachedOwner ??= "release-team"

let releaseName: string = hasEnoughScore ? "stable" : "candidate"
let auditTarget: { name: string, retries?: number } = { name: owner }
let targetRetries: number | undefined = auditTarget.retries
let auditOwner: string = auditTarget?.name

let { name = "fallback" }: { name?: string } = { }
let [priority = 1]: [number | undefined] = [undefined]

let hasRetries: boolean = retryCount < maxRetries
let canDeploy: boolean = hasEnoughScore && hasRetries

if (canDeploy) {
    status = "release-candidate"
    retryCount = retryCount + priority

    let auditLabel: Status = "automated-check"

    if (auditLabel !== undefined) {
        let auditPassed: boolean = true
    }
}

if (status === undefined) {
    status = "manual-review"
    retryCount = retryCount + 1
}
