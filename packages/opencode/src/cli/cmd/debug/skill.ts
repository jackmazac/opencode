import { EOL } from "os"
import { Effect } from "effect"
import { Skill } from "../../../skill"
import { effectCmd } from "../../effect-cmd"

export const SkillCommand = effectCmd({
  command: "skill",
  describe: "list all available skills",
  builder: (yargs) => yargs,
  handler: Effect.fn("Cli.debug.skill")(function* () {
    const skill = yield* Skill.Service
    const catalog = yield* skill.all()
    const merged = yield* Effect.forEach(
      catalog,
      (item) => skill.get(item.name).pipe(Effect.map((loaded) => loaded ?? item)),
      { concurrency: "unbounded" },
    )
    process.stdout.write(JSON.stringify(merged, null, 2) + EOL)
  }),
})
