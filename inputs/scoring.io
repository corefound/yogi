import { maxScore, minDeployScore } from "./config"
import { rawScore, testCoverage, crashPenalty } from "./metrics"

export function addWeight(input: number, weight: number): number {
    let total: number = input + weight
    return total
}

export let weightedScore: number = rawScore + testCoverage
weightedScore = weightedScore - crashPenalty

export let scorePercent: number = weightedScore * maxScore / 100
export let hasEnoughScore: boolean = scorePercent >= minDeployScore
