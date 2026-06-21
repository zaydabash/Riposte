import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ARIES_WEIGHTS,
  formatCoeff,
  LEAKAGE_BLEND_WEIGHTS,
} from "@/lib/riposte-config";

export type MathFormulaVariant =
  | "aries"
  | "tAdv"
  | "leakage"
  | "redisSearch"
  | "trace"
  | "prFix";

interface MathFormulaProps {
  variant: MathFormulaVariant;
  className?: string;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <sub className="text-[0.72em] not-italic">{children}</sub>;
}

function Var({ children }: { children: React.ReactNode }) {
  return <span className="italic">{children}</span>;
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="not-italic opacity-90">{children}</span>;
}

function Coeff({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums not-italic">{children}</span>;
}

const formulas: Record<MathFormulaVariant, ReactNode> = {
  aries: (
    <>
      <Var>ARiES</Var>
      <Op> = </Op>
      <Coeff>{formatCoeff(ARIES_WEIGHTS.M)}</Coeff>
      <Op> · </Op>
      <Var>M</Var>
      <Op> + </Op>
      <Coeff>{formatCoeff(ARIES_WEIGHTS.L)}</Coeff>
      <Op> · </Op>
      <Var>L</Var>
      <Op> + </Op>
      <Coeff>{formatCoeff(ARIES_WEIGHTS.A)}</Coeff>
      <Op> · </Op>
      <Var>A</Var>
      <Op> + </Op>
      <Coeff>{formatCoeff(ARIES_WEIGHTS.J)}</Coeff>
      <Op> · </Op>
      <Var>J</Var>
    </>
  ),
  tAdv: (
    <>
      <Var>T</Var>
      <Sub>adv</Sub>
      <Op> = </Op>
      <Op>arg min </Op>
      <Var>E</Var>
      <Op>[</Op>
      <Var>L</Var>
      <Op>(</Op>
      <Var>y</Var>
      <Sub>target</Sub>
      <Op>, </Op>
      <Var>F</Var>
      <Op>(</Op>
      <Var>T</Var>
      <Sub>adv</Sub>
      <Op> ⊕ </Op>
      <Var>x</Var>
      <Op>))</Op>
    </>
  ),
  leakage: (
    <>
      <Var>L</Var>
      <Op> = </Op>
      <Coeff>{formatCoeff(LEAKAGE_BLEND_WEIGHTS.cosine)}</Coeff>
      <Op> · </Op>
      <Var>cos</Var>
      <Op> + </Op>
      <Coeff>{formatCoeff(LEAKAGE_BLEND_WEIGHTS.entity)}</Coeff>
      <Op> · </Op>
      <Var>entity</Var>
      <Op> + </Op>
      <Coeff>{formatCoeff(LEAKAGE_BLEND_WEIGHTS.token)}</Coeff>
      <Op> · </Op>
      <Var>token</Var>
    </>
  ),
  redisSearch: (
    <>
      <span className="font-mono not-italic tracking-tight">
        FT.SEARCH idx:payloads KNN @embedding
      </span>
    </>
  ),
  trace: (
    <>
      <Var>trace</Var>
      <Op>(</Op>
      <Var>span</Var>
      <Op>) </Op>
      <Op>→ </Op>
      <Var>observability</Var>
    </>
  ),
  prFix: (
    <>
      <Var>PR</Var>
      <Op> = </Op>
      <Var>fix</Var>
      <Op>(</Op>
      <Var>VULNERABLE</Var>
      <Op>, </Op>
      <Var>T</Var>
      <Sub>adv</Sub>
      <Op>) </Op>
      <Op>→ </Op>
      <Var>HITL</Var>
    </>
  ),
};

export function MathFormula({ variant, className }: MathFormulaProps) {
  return (
    <div
      className={cn(
        "math-formula block leading-relaxed text-accent/90",
        className,
      )}
      aria-label="Mathematical formula"
    >
      {formulas[variant]}
    </div>
  );
}
