import {
  Program, Exp, CExp, DefineExp, Binding, DictExp, DictPair,
  isProgram, isDefineExp, isAtomicExp, isLitExp, isIfExp,
  isProcExp, isLetExp, isAppExp, isDictExp,
  makeProgram, makeDefineExp,
  makeAppExp, makeIfExp, makeProcExp, makeLetExp,
  makeLitExp, makeVarRef,
  parseSExp, unparseL32, makePrimOp
} from './L32/L32-ast';
import { parse as parseSexpAst } from './shared/parser';
import {SExpValue, makeEmptySExp, makeSymbolSExp, makeCompoundSExp} from './L32/L32-value';


// Rewrite a single L32 CExp
const rewriteCExp = (ce: CExp): CExp => {
  if (isDictExp(ce)) {return rewriteDictExp(ce);}
  if (isAtomicExp(ce) || isLitExp(ce)) {return ce;}
  if (isIfExp(ce)) {return makeIfExp(
                    rewriteCExp(ce.test),
                    rewriteCExp(ce.then),
                    rewriteCExp(ce.alt)
                );
  }
  if (isProcExp(ce)) {return makeProcExp(ce.args, ce.body.map(rewriteCExp));}
  if (isLetExp(ce)) {
    const bs: Binding[] = ce.bindings.map(b =>
      ({ tag: "Binding", var: b.var, val: rewriteCExp(b.val) })
    );
    return makeLetExp(bs, ce.body.map(rewriteCExp));
  }
  if (isAppExp(ce)) {
    return makeAppExp(
      rewriteCExp(ce.rator),
      ce.rands.map(rewriteCExp)
    );
  }
  return ce; // should not reach here
};

// Transform a DictExp into (dict '<alist>)
const rewriteDictExp = (de: DictExp): CExp => {
  let alist: SExpValue = makeEmptySExp();
  for (let i = de.pairs.length - 1; i >= 0; i--) {
    const pair: DictPair = de.pairs[i];
    const keyS: SExpValue = makeSymbolSExp(pair.key.var);
    let valS: SExpValue;
    if (isLitExp(pair.val)) {
      valS = pair.val.val;
    } else {
        const sexpStr = unparseL32(pair.val);
        const sexpAst = parseSexpAst(sexpStr);
        if (sexpAst.tag === "Failure") {
        throw new Error(`Failed to parse SExp string: ${sexpAst.message}`);
        }
        const parsed = parseSExp(sexpAst.value);
        if (parsed.tag === "Failure") {
        throw new Error(`Failed to parse SExp AST: ${parsed.message}`);
        }
        valS = parsed.value;
    }
    const dotted = makeCompoundSExp(keyS, valS);
    alist = makeCompoundSExp(dotted, alist);
  }
  return makeAppExp(makePrimOp("dict"), [ makeLitExp(alist) ]);
};

// Rewrite a single L32 Exp
const rewriteExp = (e: Exp): Exp =>
  isDefineExp(e)
    ? makeDefineExp(e.var, rewriteCExp(e.val))
    : rewriteCExp(e as CExp);

// Entry point
export const Dict2App = (prog: Program): Program =>
  makeProgram(prog.exps.map(rewriteExp));

/*
Purpose: Transform L32 program to L3
Signature: L32ToL3(prog)
Type: Program -> Program
*/
export const L32toL3 = (prog: Program): Program =>
    Dict2App(prog);