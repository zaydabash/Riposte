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
  | "prFix"
  | "simulatedAnnealing"
  | "crossEntropy"
  | "attackMath";

interface MathFormulaProps {
  variant: MathFormulaVariant;
  className?: string;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <sub className="text-[0.72em] not-italic">{children}</sub>;
}

function Sup({ children }: { children: React.ReactNode }) {
  return <sup className="text-[0.72em] not-italic">{children}</sup>;
}

function Fraction({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex flex-col items-center justify-center align-middle text-[0.85em] mx-1">{children}</span>;
}

function Numerator({ children }: { children: React.ReactNode }) {
  return <span className="border-b border-accent/40 px-1 pb-0.5">{children}</span>;
}

function Denominator({ children }: { children: React.ReactNode }) {
  return <span className="px-1 pt-0.5">{children}</span>;
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
  simulatedAnnealing: (
    <>
      <Var>P</Var>
      <Op>{"("}</Op>
      <Var>accept</Var>
      <Op>{") = "}</Op>
      <Var>e</Var>
      <Sup>
        <Op>{"-"}</Op>
        <Var>ΔLoss</Var>
        <Op>{" / "}</Op>
        <Var>T</Var>
      </Sup>
    </>
  ),
  crossEntropy: (
    <>
      <Var>Loss</Var>
      <Op>{" = -"}</Op>
      <Var>log</Var>
      <Op>{"("}</Op>
      <Var>P</Var>
      <Op>{"("}</Op>
      <Var>objective</Var>
      <Op>{")) + "}</Op>
      <Var>Penalty</Var>
      <Sub>refusal</Sub>
    </>
  ),
  attackMath: (
    <>
      <Var>A</Var>
      <Op> ≈ </Op>
      <Coeff>60</Coeff>
      <Op> + </Op>
      <Coeff>30</Coeff>
      <Op> · </Op>
      <Fraction>
        <Numerator>
          <Var>log</Var>
          <Op>(</Op>
          <Var>length</Var>
          <Op> + </Op>
          <Coeff>1</Coeff>
          <Op>)</Op>
        </Numerator>
        <Denominator>
          <Var>log</Var>
          <Op>(</Op>
          <Coeff>401</Coeff>
          <Op>)</Op>
        </Denominator>
      </Fraction>
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
