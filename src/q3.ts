import { Exp, Program, isProgram, isDefineExp, isCExp, isNumExp, isBoolExp, isStrExp, isVarRef, isAppExp, isIfExp, isProcExp, isPrimOp, CExp, VarDecl, PrimOp } from './L3/L3-ast';
import { Result,  makeOk, makeFailure, bind, mapResult} from './shared/result';
import { map } from 'ramda';

/*
Purpose: Transform L2 AST to JavaScript program string
Signature: l2ToJS(l2AST)
Type: [EXP | Program] => Result<string>
*/

export const l2ToJS = (exp: Exp | Program): Result<string>  => {
    if (isProgram(exp)) {
        return bind(mapResult(translateExp, exp.exps), expsJS =>
            makeOk(expsJS.join(';\n')));
    } else if (isDefineExp(exp)) {
         return bind(translateCExp(exp.val), valJS =>
             makeOk(`const ${exp.var.var} = ${valJS}`));
    }
    return translateCExp(exp);
}

const translateExp = (exp: Exp): Result<string> => {
    if (isDefineExp(exp)) {
        return bind(translateCExp(exp.val), valJS => // כאן זה בסדר לקרוא ל-translateCExp כי exp.val הוא CExp
            makeOk(`const ${exp.var.var} = ${valJS}`));
    } else if (isCExp(exp)) { 
        return translateCExp(exp);
    }
     return makeFailure(`Cannot translate unknown expression type: ${(exp as any).tag}`);
};

// Helper function to translate an L2 CExp to a JavaScript string
const translateCExp = (exp: CExp): Result<string> => {
    // Check the type of the expression and translate accordingly
    if (isNumExp(exp)) {
        return makeOk(exp.val.toString());
    } else if (isBoolExp(exp)) {
        // JS boolean literals are lowercase
        return makeOk(exp.val.toString());
    } else if (isStrExp(exp)) {
        return makeOk(JSON.stringify(exp.val));
    } else if (isVarRef(exp)) {
        return makeOk(exp.var);
    } else if (isIfExp(exp)) {
        return bind(translateCExp(exp.test), testJS =>
            bind(translateCExp(exp.then), thenJS =>
                bind(translateCExp(exp.alt), altJS =>
                    makeOk(`(${testJS} ? ${thenJS} : ${altJS})`))));
    } else if (isProcExp(exp)) {
        // Assumed from Q3 constraints that lambda body has one expression
        if (exp.body.length !== 1) {
             // Should not happen based on the assumption 
            return makeFailure("ProcExp body must contain exactly one expression for L2->JS translation.");
        }
        const paramsJS = exp.args.map(arg => arg.var).join(','); // (x y) -> "x,y"
        return bind(translateCExp(exp.body[0]), bodyJS =>
            makeOk(`((${paramsJS}) => ${bodyJS})`));
    } else if (isAppExp(exp)) { 
        if (isPrimOp(exp.rator)) { 
            const op = exp.rator.op;
            const rands = exp.rands; 
            const translatedRandsResult = mapResult(translateCExp, rands); 
            switch (op) {
                case '+':
                case '*':
                    if (rands.length === 0) return makeFailure(`${op} expects at least one argument`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS.join(` ${op} `)})`));
                case '-':
                case '/':
                case '<':
                case '>':
                    if (rands.length !== 2) return makeFailure(`${op} expects exactly two arguments`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS[0]} ${op} ${randsJS[1]})`));

               case '=':
                case 'eq?':
                    if (rands.length !== 2) return makeFailure(`${op} expects exactly two arguments`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS[0]} === ${randsJS[1]})`));

                case 'and':
                    if (rands.length !== 2) return makeFailure(`and expects exactly two arguments`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS[0]} && ${randsJS[1]})`));

                case 'or':
                    if (rands.length !== 2) return makeFailure(`or expects exactly two arguments`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS[0]} || ${randsJS[1]})`));

                case 'not':
                    if (rands.length !== 1) return makeFailure(`not expects exactly one argument`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`(!${randsJS[0]})`));

                case 'number?':
                case 'boolean?':
                    if (rands.length !== 1) return makeFailure(`${op} expects exactly one argument`);
                    return bind(translatedRandsResult, randsJS =>
                        makeOk(`${op}(${randsJS[0]})`));


                case 'eq?':
                    if (rands.length !== 2) return makeFailure(`eq? expects exactly two arguments`);
                     return bind(translatedRandsResult, randsJS =>
                        makeOk(`(${randsJS} === ${randsJS[4]})`));

                default:
                    return makeFailure(`Unknown primitive operator: ${op}`);
            }
        } else {
            return bind(translateCExp(exp.rator), ratorJS =>
                bind(mapResult(translateCExp, exp.rands), randsJS => 
                    makeOk(`${ratorJS}(${randsJS.join(',')})`)));
        }
    }
    return makeFailure(`Unsupported AST type for L2 to JS translation: ${exp.tag}`);
};