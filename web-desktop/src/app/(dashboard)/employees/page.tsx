"use client";
// Employees: rename, make Inactive (left the company: history stays, no new Cash Advances), or delete
// one who never received a Cash Advance. GLOSSARY: Inactive Employee.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, CardHeader, cx, Empty, inputClass, Notice, PageHeader, Pill, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useEmployees } from "@/lib/queries";
import type { Employee } from "@/lib/types";

export default function EmployeesPage() {
  const qc = useQueryClient();
  const employees = useEmployees();
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => api.post<Employee>("/api/employees", { name: name.trim() }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
  const list = employees.data ?? [];
  const active = list.filter((e) => e.active);
  const inactive = list.filter((e) => !e.active);

  return (
    <div className="space-y-8">
      <PageHeader title="Employees" sub="The people who receive Cash Advances." />

      <Card>
        <CardHeader title="Add an Employee" />
        <form className="flex flex-wrap items-center gap-3 px-6 py-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
          <input className={cx(inputClass, "max-w-sm")} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" />
          <Button type="submit" variant="primary" busy={add.isPending} disabled={!name.trim()}>Add</Button>
          {add.isError && <Notice tone="bad" className="w-full">{errorMessage(add.error)}</Notice>}
        </form>
      </Card>

      <Card>
        <CardHeader title={`Active (${active.length})`} />
        {employees.isPending ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : employees.isError ? (
          <div className="p-6"><Notice tone="bad">{errorMessage(employees.error)}</Notice></div>
        ) : active.length === 0 ? (
          <Empty>No active Employees yet.</Empty>
        ) : (
          <ul className="stagger space-y-1 p-2">{active.map((e) => <EmployeeRow key={e.id} e={e} />)}</ul>
        )}
      </Card>

      {inactive.length > 0 && (
        <Card>
          <CardHeader title={`Inactive (${inactive.length})`} sub="Their records stay. They can’t receive a new Cash Advance." />
          <ul className="space-y-1 p-2">{inactive.map((e) => <EmployeeRow key={e.id} e={e} />)}</ul>
        </Card>
      )}
    </div>
  );
}

function EmployeeRow({ e }: { e: Employee }) {
  const qc = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(e.name);
  const [sure, setSure] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const done = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["cash-advances"] });
    qc.invalidateQueries({ queryKey: ["liquidation"] });
  };
  const save = useMutation({
    mutationFn: (body: { name?: string; active?: boolean }) => api.patch<Employee>(`/api/employees/${e.id}`, body),
    onSuccess: () => { setRenaming(false); setDeactivating(false); done(); },
  });
  const del = useMutation({ mutationFn: () => api.delete(`/api/employees/${e.id}`), onSuccess: done });
  const advances = e.cash_advances ?? 0;
  const open = e.open_liquidations ?? 0;
  const error = save.error ?? del.error;

  return (
    <li className="rounded-2xl px-4 py-3 transition-colors duration-150 hover:bg-sunken/60">
      <div className="flex flex-wrap items-center gap-3">
        {renaming ? (
          <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); if (name.trim()) save.mutate({ name: name.trim() }); }}>
            <input className={cx(inputClass, "h-8 max-w-xs")} value={name} onChange={(ev) => setName(ev.target.value)} autoFocus aria-label="Name" />
            <Button type="submit" size="sm" variant="primary" busy={save.isPending} disabled={!name.trim()}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setName(e.name); }}>Cancel</Button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{e.name}</p>
            <p className="text-sm text-muted">
              {advances === 0 ? "No Cash Advances yet" : `${advances} Cash Advance${advances === 1 ? "" : "s"}`}
              {open > 0 && ` · ${open} open`}
            </p>
          </div>
        )}
        {!e.active && <Pill>Inactive</Pill>}
        {!renaming && !sure && !deactivating && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>Rename</Button>
            {e.active ? (
              <Button size="sm" onClick={() => (open > 0 ? setDeactivating(true) : save.mutate({ active: false }))}
                busy={save.isPending && save.variables?.active === false}>Make inactive</Button>
            ) : (
              <Button size="sm" onClick={() => save.mutate({ active: true })} busy={save.isPending && save.variables?.active === true}>Make active</Button>
            )}
            {advances === 0 && <Button size="sm" variant="ghost" onClick={() => setSure(true)}>Delete</Button>}
          </div>
        )}
        {sure && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="danger" busy={del.isPending} onClick={() => del.mutate()}>Delete {e.name}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSure(false)}>Keep</Button>
          </div>
        )}
      </div>
      {deactivating && (
        <Notice tone="warn" className="enter mt-3">
          <p>{e.name} has {open} open Liquidation{open === 1 ? "" : "s"}. {open === 1 ? "It stays" : "They stay"} fully workable; {e.name} just can’t get a new Cash Advance.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" busy={save.isPending} onClick={() => save.mutate({ active: false })}>Make inactive</Button>
            <Button size="sm" variant="ghost" onClick={() => setDeactivating(false)}>Cancel</Button>
          </div>
        </Notice>
      )}
      {error && <Notice tone="bad" className="mt-2">{errorMessage(error)}</Notice>}
    </li>
  );
}
