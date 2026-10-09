"use client";
// Edit a Cash Advance's details while its Liquidation is OPEN. The server re-runs the checks: a new
// Spending Period changes which receipts pass the date check, and a new amount changes the totals.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useEmployees } from "@/lib/queries";
import type { CashAdvance, Employee, Liquidation } from "@/lib/types";
import { Button, Card, CardHeader, cx, inputClass, Label, MoneyInput, Notice, selectClass } from "./ui";
import { toast } from "@/lib/toast";

const NEW_EMPLOYEE = "new";

export function EditCashAdvance({ liq, onDone }: { liq: Liquidation; onDone: () => void }) {
  const ca = liq.cash_advance;
  const qc = useQueryClient();
  const employees = useEmployees();
  const [employee, setEmployee] = useState(String(ca.employee.id));
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState(ca.amount.toFixed(2));
  const [purpose, setPurpose] = useState(ca.purpose);
  const [released, setReleased] = useState(ca.released_on);
  const [end, setEnd] = useState(ca.spending_end_on);

  const save = useMutation({
    mutationFn: async () => {
      let employeeId = Number(employee);
      if (employee === NEW_EMPLOYEE) {
        employeeId = (await api.post<Employee>("/api/employees", { name: newName.trim() })).id;
      }
      return api.patch<CashAdvance>(`/api/cash-advances/${ca.id}`, {
        employee_id: employeeId, amount, purpose: purpose.trim(), released_on: released, spending_end_on: end,
      });
    },
    onSuccess: () => {
      toast("Cash Advance updated", { body: liq.receipts.length ? "Every receipt was re-checked." : undefined });
      qc.invalidateQueries({ queryKey: ["liquidation", liq.id] });
      qc.invalidateQueries({ queryKey: ["cash-advances"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      onDone();
    },
  });

  const periodChanged = released !== ca.released_on || end !== ca.spending_end_on;
  const ready = (employee !== NEW_EMPLOYEE || newName.trim()) && Number(amount) > 0 && purpose.trim() && released && end && end >= released;

  return (
    <Card className="enter">
      <CardHeader title="Edit Cash Advance" sub="Changes apply to this Liquidation right away." />
      <form
        className="grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <Label label="Employee">
          <select className={selectClass} value={employee} onChange={(e) => setEmployee(e.target.value)} required>
            {employees.data?.filter((e) => e.active || e.id === ca.employee.id).map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (inactive)"}</option>)}
            <option value={NEW_EMPLOYEE}>+ New Employee…</option>
          </select>
        </Label>
        {employee === NEW_EMPLOYEE ? (
          <Label label="New Employee’s name">
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus required />
          </Label>
        ) : <div className="hidden sm:block" />}
        <Label label="Amount">
          <MoneyInput className="h-10" value={amount} onChange={setAmount} placeholder="15,000.00" required />
        </Label>
        <Label label="Purpose">
          <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
        </Label>
        <Label label="Released on">
          <input className={inputClass} type="date" value={released} onChange={(e) => setReleased(e.target.value)} required />
        </Label>
        <Label label="Spending ends on" hint="Receipts dated outside this Spending Period are rejected.">
          <input className={inputClass} type="date" value={end} min={released} onChange={(e) => setEnd(e.target.value)} required />
        </Label>
        {periodChanged && liq.receipts.length > 0 && (
          <Notice tone="info" className="sm:col-span-2">Every receipt is re-checked against the new Spending Period when you save.</Notice>
        )}
        {save.isError && <Notice tone="bad" className="sm:col-span-2">{errorMessage(save.error)}</Notice>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" busy={save.isPending} disabled={!ready}>Save</Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
