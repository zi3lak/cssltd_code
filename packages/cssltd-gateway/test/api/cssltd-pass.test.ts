import { describe, expect, test } from "bun:test"
import { parseCssltdPassState } from "../../src/api/cssltd-pass"

describe("parseCssltdPassState", () => {
  test("parses batched tRPC subscription data", () => {
    const state = parseCssltdPassState([
      {
        result: {
          data: {
            json: {
              subscription: {
                tier: "tier_199",
                currentPeriodBaseCreditsUsd: 199,
                currentPeriodUsageUsd: 73.27,
                currentPeriodBonusCreditsUsd: 99.5,
                nextBillingAt: "2026-07-01T00:00:00.000Z",
              },
            },
          },
        },
      },
    ])

    expect(state).toEqual({
      currentPeriodBaseCreditsUsd: 199,
      currentPeriodUsageUsd: 73.27,
      currentPeriodBonusCreditsUsd: 99.5,
      nextBillingAt: "2026-07-01T00:00:00.000Z",
    })
  })

  test("parses plain subscription payload", () => {
    const state = parseCssltdPassState([
      {
        result: {
          data: {
            subscription: {
              tier: "tier_199",
              status: "active",
              currentPeriodBaseCreditsUsd: 199,
              currentPeriodUsageUsd: 0.01,
              currentPeriodBonusCreditsUsd: 29.85,
              isBonusUnlocked: false,
              nextBillingAt: "2026-07-20T09:30:20.806Z",
            },
            isEligibleForFirstMonthPromo: false,
          },
        },
      },
    ])

    expect(state).toEqual({
      currentPeriodBaseCreditsUsd: 199,
      currentPeriodUsageUsd: 0.01,
      currentPeriodBonusCreditsUsd: 29.85,
      nextBillingAt: "2026-07-20T09:30:20.806Z",
    })
  })

  test("returns null without period amounts", () => {
    expect(parseCssltdPassState({ status: "none" })).toBeNull()
  })
})
