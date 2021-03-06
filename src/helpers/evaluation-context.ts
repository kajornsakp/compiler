import * as fs from 'fs'
import * as path from 'path'
import { Config } from '../utils/config'
import * as LogicAST from './logic-ast'
import * as LogicScope from './logic-scope'
import * as LogicUnify from './logic-unify'
import * as LogicEvaluate from './logic-evaluate'
import { Reporter } from './reporter'
import { nonNullable } from '../utils'

export const generate = (config: Config, reporter: Reporter) => {
  const standardLibsPath = path.join(__dirname, '../../static/logic')
  const standardLibs = fs.readdirSync(standardLibsPath)

  const libraryFiles: LogicAST.AST.Program[] = standardLibs.map(
    x =>
      LogicAST.makeProgram(
        JSON.parse(fs.readFileSync(path.join(standardLibsPath, x), 'utf8'))
      ) as LogicAST.AST.Program
  )

  const standardLibsProgram = LogicAST.joinPrograms(libraryFiles)

  const logicPrograms = Object.keys(config.logicFiles)
    .map(k => {
      const node = LogicAST.makeProgram(config.logicFiles[k])
      if (!node) {
        return undefined
      }
      return {
        in: k,
        node,
      }
    })
    .filter(nonNullable)

  const scopeContext = LogicScope.build(
    [{ node: standardLibsProgram, in: 'standard library' }].concat(
      logicPrograms
    ),
    reporter
  )

  const programNode = LogicAST.joinPrograms([
    standardLibsProgram,
    ...logicPrograms.map(x => x.node),
  ])

  const unificationContext = LogicUnify.makeUnificationContext(
    programNode,
    scopeContext,
    reporter
  )
  const substitution = LogicUnify.unify(
    unificationContext.constraints,
    reporter
  )

  const evaluationContext = LogicEvaluate.evaluate(
    programNode,
    programNode,
    scopeContext,
    unificationContext,
    substitution,
    reporter
  )

  return evaluationContext
}
