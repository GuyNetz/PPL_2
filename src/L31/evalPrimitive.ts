import { reduce } from "ramda";
import { PrimOp } from "./L31-ast";
import { isCompoundSExp, isSExp,  isEmptySExp, isSymbolSExp, makeCompoundSExp, makeEmptySExp, CompoundSExp, EmptySExp, Value, SExpValue, SymbolSExp } from "./L31-value";
import { List, allT, first, isNonEmptyList, rest } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure } from "../shared/result";
import { format } from "../shared/format";

export const applyPrimitive = (proc: PrimOp, args: Value[]): Result<Value> =>
    proc.op === "+" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x + y, 0, args)) : 
                                              makeFailure(`+ expects numbers only: ${format(args)}`)) :
    proc.op === "-" ? minusPrim(args) :
    proc.op === "*" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x * y, 1, args)) : 
                                              makeFailure(`* expects numbers only: ${format(args)}`)) :
    proc.op === "/" ? divPrim(args) :
    proc.op === ">" ? makeOk(args[0] > args[1]) :
    proc.op === "<" ? makeOk(args[0] < args[1]) :
    proc.op === "=" ? makeOk(args[0] === args[1]) :
    proc.op === "not" ? makeOk(!args[0]) :
    proc.op === "and" ? isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] && args[1]) : 
                                                                   makeFailure(`Arguments to "and" not booleans: ${format(args)}`) :
    proc.op === "or" ? isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] || args[1]) : 
                                                                  makeFailure(`Arguments to "or" not booleans: ${format(args)}`) :
    proc.op === "eq?" ? makeOk(eqPrim(args)) :
    proc.op === "string=?" ? makeOk(args[0] === args[1]) :
    proc.op === "cons" ? makeOk(consPrim(args[0], args[1])) :
    proc.op === "car" ? carPrim(args[0]) :
    proc.op === "cdr" ? cdrPrim(args[0]) :
    proc.op === "list" ? makeOk(listPrim(args)) :
    proc.op === "pair?" ? makeOk(isPairPrim(args[0])) :
    proc.op === "number?" ? makeOk(typeof (args[0]) === 'number') :
    proc.op === "boolean?" ? makeOk(typeof (args[0]) === 'boolean') :
    proc.op === "symbol?" ? makeOk(isSymbolSExp(args[0])) :
    proc.op === "string?" ? makeOk(isString(args[0])) :
    proc.op === "dict" ? (args.length === 1 ? checkDictStructure(args[0]) :
                                            makeFailure(`dict expects a single argument: ${format(args)}`)) :
    proc.op === "get" ? applyGetPrimitive(args) : 
    proc.op === "dict?" ? (args.length === 1 ? (isProperList(args[0]) && hasValidDictElements(args[0]) ? makeOk(true) : makeOk(false)) :
                                            makeFailure(`dict? expects a single argument: ${format(args)}`)) :
    makeFailure(`Bad primitive op: ${format(proc.op)}`);

/*********************************************************dict implementation*********************************************************/

const checkDictStructure = (val: Value): Result<SExpValue> => {
    //make sure val is an S-Expression
    if(!isSExp(val)){ return makeFailure(`dict expects an S-Expression value but recieved ${format(val)}`);}
    const sexp = val;
    //check if the S-Expression is a list of symbol-value pairs
    if(!isValidDictFormat(sexp)) {
        return makeFailure(`Primitive 'dict' expects a list of symbol-value pairs (e.g., '((a . 1) (b . #t))), but received invalid structure: ${format(sexp)}`);
    }
    return makeOk(sexp);
}

//recursive function to check if the S-Expression is a list of symbol-value pairs
const isValidDictFormat = (sexp: SExpValue): boolean => {
    if (isEmptySExp(sexp)) { 
        return true;
    }
    if (isCompoundSExp(sexp)) { 
        return isValidDictPair(sexp.val1) && isValidDictFormat(sexp.val2);
    }
    return false;
};

//helper function to check if a pair is a valid symbol-value pair
const isValidDictPair = (sexp: SExpValue): boolean => {
    return isCompoundSExp(sexp) && isSymbolSExp(sexp.val1); 
};

/*********************************************************get implementation*********************************************************/
const applyGetPrimitive = (args: Value[]): Result<Value> => {
    //make sure args is a list of 2 elements
    if (args.length !== 2) {
        return makeFailure(`Primitive 'get' expects 2 arguments, but received ${args.length}: ${format(args)}`);
    }
    const dictVal = args[0];
    const keyVal = args[1];

    //check if the first argument is a dictionary S-Expression and the second is a symbol
    if (!isSExp(dictVal)) {
        return makeFailure(`Primitive 'get' expects its first argument to be a dictionary S-Expression, but received: ${format(dictVal)}`);
    }
    if (!isSymbolSExp(keyVal)) {
        return makeFailure(`Primitive 'get' expects its second argument to be a symbol key, but received: ${format(keyVal)}`);
    }
    return findKeyInDictSExp(dictVal, keyVal);
};

//recursive function to find the value associated with a key in a dictionary S-Expression
const findKeyInDictSExp = (dictSExp: SExpValue, key: SymbolSExp): Result<Value> => {
    if (isEmptySExp(dictSExp)) { 
        return makeFailure(`Key '${key.val}' not found in dictionary`);
    }
    if (isCompoundSExp(dictSExp)) { 
        const currentPair = dictSExp.val1; 
        const restOfList = dictSExp.val2;
        if (isCompoundSExp(currentPair) && isSymbolSExp(currentPair.val1)) { 
            const currentKey = currentPair.val1 as SymbolSExp; 
            const currentValue = currentPair.val2;

            if (currentKey.val === key.val) {
                return makeOk(currentValue);
            } else {
                return findKeyInDictSExp(restOfList, key);
            }
        } else {
            return makeFailure(`Invalid dictionary format: Expected a list of symbol-value pairs, but encountered an invalid element: ${format(currentPair)}`);
        }
    }
    return makeFailure(`Invalid dictionary format: Expected a list of pairs, but encountered invalid structure: ${format(dictSExp)}`);
};

/*********************************************************dict? implementation*********************************************************/
const isProperList = (val: SExpValue): boolean => {
    // empty list is a proper list
    if (isEmptySExp(val)) {
        return true;
    }
    // check if val is a compound SExp
    if (isCompoundSExp(val)) {
        return isProperList(val.val2);
    }
    return false;
};

const isValidDictElement = (element: SExpValue): boolean => {
    // check if the element is a compound SExp
    if (isCompoundSExp(element)) {
        return isSymbolSExp(element.val1);
    }
    return false;
};

const hasValidDictElements = (list: SExpValue): boolean => {
    // check if the list is empty
    if (isEmptySExp(list)) {
        return true;
    }
    // check if the list is a compound SExp
    if (isCompoundSExp(list)) {
        const head = list.val1; 
        const tail = list.val2; 
        
        return isValidDictElement(head) && hasValidDictElements(tail);
    }
    return false;
};

const minusPrim = (args: Value[]): Result<number> => {
    // TODO complete
    const x = args[0], y = args[1];
    if (isNumber(x) && isNumber(y)) {
        return makeOk(x - y);
    }
    else {
        return makeFailure(`Type error: - expects numbers ${format(args)}`);
    }
};

const divPrim = (args: Value[]): Result<number> => {
    // TODO complete
    const x = args[0], y = args[1];
    if (isNumber(x) && isNumber(y)) {
        return makeOk(x / y);
    }
    else {
        return makeFailure(`Type error: / expects numbers ${format(args)}`);
    }
};

const eqPrim = (args: Value[]): boolean => {
    const x = args[0], y = args[1];
    if (isSymbolSExp(x) && isSymbolSExp(y)) {
        return x.val === y.val;
    }
    else if (isEmptySExp(x) && isEmptySExp(y)) {
        return true;
    }
    else if (isNumber(x) && isNumber(y)) {
        return x === y;
    }
    else if (isString(x) && isString(y)) {
        return x === y;
    }
    else if (isBoolean(x) && isBoolean(y)) {
        return x === y;
    }
    else {
        return false;
    }
};

const carPrim = (v: Value): Result<Value> => 
    isCompoundSExp(v) ? makeOk(v.val1) :
    makeFailure(`Car: param is not compound ${format(v)}`);

const cdrPrim = (v: Value): Result<Value> =>
    isCompoundSExp(v) ? makeOk(v.val2) :
    makeFailure(`Cdr: param is not compound ${format(v)}`);

const consPrim = (v1: Value, v2: Value): CompoundSExp =>
    makeCompoundSExp(v1, v2);

export const listPrim = (vals: List<Value>): EmptySExp | CompoundSExp =>
    isNonEmptyList<Value>(vals) ? makeCompoundSExp(first(vals), listPrim(rest(vals))) :
    makeEmptySExp();

const isPairPrim = (v: Value): boolean =>
    isCompoundSExp(v);
