import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { dataOrigin } from "../../src/db/schema";
import { operatorVerificationDecision } from "../../src/domain/events";
import { setMentorStudentStatus } from "../../src/domain/mentor-student-status";
import { setSkillVerification } from "../../src/domain/skill-verification";
import { formatKazakhstanTime } from "../../src/domain/time";
import {
  getPendingSkillProof,
  listPendingSkillEvidence,
  listPendingStudentVerifications,
} from "../../src/services/operator/verification-queue";

const usage =
  "Usage: verify-skill.ts queue <operator ID> | proof <operator ID> <skill UUID> | decide <operator ID> <skill UUID> <verified|rejected> | students <operator ID> | student <operator ID> <mentor ID> <verified|rejected>";
const unavailable = "Pending skill unavailable.";

async function main() {
  const [command, operatorId, ...args] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !operatorId) throw new Error(usage);
  if (!process.stdout.isTTY) throw new Error("Run from a private terminal.");

  if (command === "queue" && args.length === 0) {
    const evidence = await listPendingSkillEvidence(db, operatorId);
    console.log(
      JSON.stringify(
        evidence.map(({ submittedAt, ...item }) => ({
          ...item,
          submittedAt: formatKazakhstanTime(submittedAt, "en"),
        })),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "proof" && args.length === 1) {
    const proof = await getPendingSkillProof(db, operatorId, args[0]);
    if (!proof) throw new Error(unavailable);
    console.log(JSON.stringify(proof, null, 2));
    return;
  }
  if (command === "students" && args.length === 0) {
    console.log(
      JSON.stringify(
        await listPendingStudentVerifications(db, operatorId),
        null,
        2,
      ),
    );
    return;
  }
  const [subjectId, decision] = args;
  const { success, data: state } =
    operatorVerificationDecision.safeParse(decision);
  if (
    (command !== "decide" && command !== "student") ||
    args.length !== 2 ||
    !success
  )
    throw new Error(usage);
  if (
    !z.enum(dataOrigin.enumValues).safeParse(process.env.SKILLSWAP_DATA_ORIGIN)
      .success
  )
    throw new Error("Set SKILLSWAP_DATA_ORIGIN for this environment.");

  if (command === "student") {
    const updated = await setMentorStudentStatus(db, {
      operatorId,
      mentorId: subjectId,
      state,
    });
    if (!updated) throw new Error("No student status change.");
    console.log(updated.mentorId, state);
    return;
  }

  const updated = await setSkillVerification(db, {
    operatorParticipantId: operatorId,
    skillEvidenceId: subjectId,
    state,
  });
  if (!updated) throw new Error(unavailable);
  console.log(updated.skillId, updated.state);
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the operator ID and the mentor ID or skill UUID."
        : error instanceof Error &&
            /^(Usage:|Run from|Set SKILLSWAP_DATA_ORIGIN|Active operator required|Pending skill unavailable|No student status change)/.test(
              error.message,
            )
          ? error.message
          : "Could not complete the operator command.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
