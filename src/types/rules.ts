export type Operator = ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains"

export type RuleVariable = "plan" | "account_age" | "seats" | "mrr" | "email"

export interface Condition {
  variable: RuleVariable
  operator: Operator
  value: string | number
}

export interface Rule {
  id: string
  account_id: string
  name: string
  priority: number
  condition_logic: "AND" | "OR"
  conditions: Condition[]
  prompt_addition: string
  created_at: string
  updated_at: string
}
