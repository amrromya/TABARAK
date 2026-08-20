import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  money,
  today,
  useToast,
} from "../components/ui";
import { t } from "../i18n";
import type {
  Employee,
  NewEmployee,
  NewVacation,
  Salary,
  Vacation,
} from "../types";

const VACATION_TYPES: Record<string, string> = {
  annual: "annualLeave",
  sick: "sickLeave",
};

const VACATION_STATUS: Record<string, string> = {
  pending: "pendingStatus",
  approved: "approvedStatus",
  rejected: "rejectedStatus",
};

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<NewEmployee>({
    name: "",
    phone: "",
    email: "",
    position: "",
    salary: 0,
    hire_date: today(),
    notes: "",
  });

  const [paying, setPaying] = useState<Employee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState("");

  const [vacationEmployee, setVacationEmployee] = useState<Employee | null>(
    null,
  );
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [vacForm, setVacForm] = useState<NewVacation>({
    employee_id: 0,
    start_date: today(),
    end_date: today(),
    days: 1,
    type: "annual",
    notes: "",
    status: "pending",
  });
  const [editingVac, setEditingVac] = useState<Vacation | null>(null);

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emp, sal] = await Promise.all([
        api.listEmployees(),
        api.listSalaries(),
      ]);
      setEmployees(emp);
      setSalaries(sal);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return employees.filter(
      (e) =>
        !search ||
        e.name.includes(search) ||
        (e.position ?? "").includes(search) ||
        (e.phone ?? "").includes(search),
    );
  }, [employees, search]);

  const totalSalaries = useMemo(
    () => employees.reduce((s, e) => s + e.salary, 0),
    [employees],
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateEmployee(editing.id, form);
        notify(t("employeeEdited"));
      } else {
        await api.createEmployee(form);
        notify(t("employeeAdded"));
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (e: Employee) => {
    if (
      !confirmDialog(t("confirmDeleteEmployeeMsg"))
    )
      return;
    try {
      await api.deleteEmployee(e.id);
      notify(t("employeeDeleted"));
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const recordSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    if (payAmount <= 0) {
      notify(t("amountMustBePositive"), "error");
      return;
    }
    try {
      await api.createSalary({
        employee_id: paying.id,
        date: payDate,
        amount: payAmount,
        notes: payNotes || null,
      });
      notify(`${t("salaryPaid")} ${money(payAmount)} - ${paying.name}`);
      setPaying(null);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const loadVacations = async (employee: Employee) => {
    try {
      const [v, s] = await Promise.all([
        api.listVacations(employee.id),
        api.listSalaries(employee.id),
      ]);
      setVacations(v);
      setSalaries(s);
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const openVacations = async (employee: Employee) => {
    setVacationEmployee(employee);
    setVacForm({
      employee_id: employee.id,
      start_date: today(),
      end_date: today(),
      days: 1,
      type: "annual",
      notes: "",
      status: "pending",
    });
    setEditingVac(null);
    await loadVacations(employee);
  };

  const saveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationEmployee) return;
    try {
      if (editingVac) {
        await api.updateVacation(editingVac.id, vacForm);
        notify(t("vacationEdited"));
      } else {
        await api.createVacation(vacForm);
        notify(t("vacationAdded"));
      }
      setVacForm({
        employee_id: vacationEmployee.id,
        start_date: today(),
        end_date: today(),
        days: 1,
        type: "annual",
        notes: "",
        status: "pending",
      });
      setEditingVac(null);
      await loadVacations(vacationEmployee);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const editVacation = (v: Vacation) => {
    setEditingVac(v);
    setVacForm({
      employee_id: v.employee_id,
      start_date: v.start_date,
      end_date: v.end_date,
      days: v.days,
      type: v.type || "annual",
      notes: v.notes ?? "",
      status: v.status || "pending",
    });
  };

  const removeVacation = async (v: Vacation) => {
    if (!confirmDialog(t("confirmDeleteVacation"))) return;
    try {
      await api.deleteVacation(v.id);
      notify(t("vacationDeleted"));
      if (vacationEmployee) await loadVacations(vacationEmployee);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeSalary = async (s: Salary) => {
    if (!confirmDialog(t("confirmDeleteOperation"))) return;
    try {
      await api.deleteSalary(s.id);
      notify(t("paymentDeletedEmp"));
      if (vacationEmployee) await loadVacations(vacationEmployee);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const totalPaid = useMemo(
    () => salaries.reduce((s, x) => s + x.amount, 0),
    [salaries],
  );

  return (
    <div className="page emp-page">
      <div className="page-head">
        <h1>{t("employees")}</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder={t("searchPlaceholderEmp")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                phone: "",
                email: "",
                position: "",
                salary: 0,
                hire_date: today(),
                notes: "",
              });
              setShowForm(true);
            }}
          >
            {t("newEmployeeBtn")}
          </button>
        </div>
      </div>

      <div className="cust-stats-grid">
        <div className="cust-stat-card cust-stat-blue">
          <div className="cust-stat-icon">👥</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{employees.length}</div>
            <div className="cust-stat-label">{t("totalEmployeesLabel")}</div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-green">
          <div className="cust-stat-icon">💰</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{money(totalSalaries)}</div>
            <div className="cust-stat-label">{t("monthlySalariesTotal")}</div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-amber">
          <div className="cust-stat-icon">💰</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{money(totalPaid)}</div>
            <div className="cust-stat-label">
              {t("salaryExpensesTotal")} ({salaries.length}
              {" "})
            </div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-red">
          <div className="cust-stat-icon">📅</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{vacations.length}</div>
            <div className="cust-stat-label">{t("totalVacationsLabel")}</div>
          </div>
        </div>
      </div>

      <div className="table-wrap cust-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("positionLabel")}</th>
              <th>{t("phone")}</th>
              <th>{t("emailLabel")}</th>
              <th>{t("monthlySalaryLabel")}</th>
              <th>{t("hireDateLabel")}</th>
              <th>{t("notes")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="empty">
                  {t("loading")}
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  {t("noEmployeesYet")}
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="strong">
                  <div className="cust-name-cell">
                    <span className="cust-avatar">{e.name.charAt(0)}</span>
                    <span>{e.name}</span>
                  </div>
                </td>
                <td>{e.position ?? "—"}</td>
                <td>
                  {e.phone ? (
                    <a className="cust-phone-link" href={`tel:${e.phone}`}>
                      📞 {e.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{e.email ?? "—"}</td>
                <td className="strong">{money(e.salary)}</td>
                <td>{e.hire_date ? fmtDate(e.hire_date) : "—"}</td>
                <td className="cust-notes-cell">{e.notes ?? "—"}</td>
                <td className="actions emp-actions">
                  <button
                    className="btn sm primary"
                    onClick={() => {
                      setPaying(e);
                      setPayAmount(e.salary);
                      setPayNotes("");
                      setPayDate(today());
                    }}
                    title={t("paySalaryTitle")}
                  >
                    💰
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => openVacations(e)}
                    title={t("vacationsTitle")}
                  >
                    📅
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      setEditing(e);
                      setForm({
                        name: e.name,
                        phone: e.phone ?? "",
                        email: e.email ?? "",
                        position: e.position ?? "",
                        salary: e.salary,
                        hire_date: e.hire_date ?? today(),
                        notes: e.notes ?? "",
                      });
                      setShowForm(true);
                    }}
                    title={t("edit")}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={() => remove(e)}
                    title={t("delete")}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? t("editEmployeeTitle") : t("newEmployeeTitle")}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form-grid">
            <Field label={t("employeeNameRequired")}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={t("positionLabel")}>
              <input
                value={form.position ?? ""}
                onChange={(e) =>
                  setForm({ ...form, position: e.target.value })
                }
                placeholder={t("positionPlaceholder")}
              />
            </Field>
            <Field label={t("phoneNumberLabelEmp")}>
              <input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label={t("emailLabelEmp")}>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t("monthlySalaryRequired")}>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.salary}
                onChange={(e) =>
                  setForm({ ...form, salary: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t("hireDateLabelEmp")}>
              <input
                type="date"
                value={form.hire_date ?? today()}
                onChange={(e) =>
                  setForm({ ...form, hire_date: e.target.value })
                }
              />
            </Field>
            <Field label={t("notes")}>
              <input
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editing ? t("saveChanges") : t("add")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {paying && (
        <Modal
          title={`${t("paySalaryModalTitle")} ${paying.name}`}
          onClose={() => setPaying(null)}
        >
          <form onSubmit={recordSalary} className="form-grid">
            <Field label={t("monthlySalaryLabel2")}>
              <input value={money(paying.salary)} disabled />
            </Field>
            <Field label={t("paymentAmountLabelEmp")}>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
            </Field>
            <Field label={t("date")}>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </Field>
            <Field label={t("notes")}>
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder={t("optionalLabelShort")}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {t("recordPaymentBtnEmp")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPaying(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {vacationEmployee && (
        <Modal
          title={`${t("vacationManagementTitle")} ${vacationEmployee.name}`}
          onClose={() => {
            setVacationEmployee(null);
            setVacations([]);
            setSalaries([]);
          }}
          width="980px"
        >
          <div className="emp-vac-header">
            <div className="emp-vac-info">
              <div className="emp-vac-name">{vacationEmployee.name}</div>
              <div className="emp-vac-meta">
                📞 {vacationEmployee.phone ?? t("noPhoneEmp")} | 💰{" "}
                {money(vacationEmployee.salary)} {t("perMonth")}
              </div>
            </div>
            <div className="emp-vac-balance">
              <span>{t("totalExpenses")}</span>
              <b className="text-green">{money(totalPaid)}</b>
            </div>
          </div>

          <div className="emp-vac-section">
            <h4 className="stmt-section-title">{t("salaryPaymentsLog")}</h4>
            <div className="stmt-table-wrap">
              <table className="table stmt-table">
                <thead>
                  <tr>
                    <th>{t("transactionNumberLabel")}</th>
                    <th>{t("date")}</th>
                    <th>{t("amountLabel")}</th>
                    <th>{t("notes")}</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        {t("noSalaryPayments")}
                      </td>
                    </tr>
                  )}
                  {salaries.map((s) => (
                    <tr key={s.id}>
                      <td className="strong">#{s.id}</td>
                      <td>{fmtDate(s.date)}</td>
                      <td className="strong text-green">{money(s.amount)}</td>
                      <td>{s.notes ?? "—"}</td>
                      <td>
                        <button
                          className="btn sm danger"
                          onClick={() => removeSalary(s)}
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {salaries.length > 0 && (
                    <tfoot>
                      <tr className="stmt-tfoot">
                        <td colSpan={2} className="strong">
                          {t("totalExpensesFooter")}
                        </td>
                        <td className="strong text-green">
                          {money(totalPaid)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="emp-vac-section">
            <div className="stmt-section-head">
              <h4 className="stmt-section-title">{t("vacationManagement")}</h4>
              <button
                className="btn sm primary"
                onClick={() => {
                  setEditingVac(null);
                  setVacForm({
                    employee_id: vacationEmployee.id,
                    start_date: today(),
                    end_date: today(),
                    days: 1,
                    type: "annual",
                    notes: "",
                    status: "pending",
                  });
                }}
              >
                {t("newVacationBtn")}
              </button>
            </div>

            {editingVac && (
              <form onSubmit={saveVacation} className="form-grid emp-vac-form">
                <Field label={t("vacationTypeLabel")}>
                  <select
                    value={vacForm.type ?? "annual"}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, type: e.target.value })
                    }
                  >
                    <option value="annual">{t("annualLeave")}</option>
                    <option value="sick">{t("sickLeave")}</option>
                  </select>
                </Field>
                <Field label={t("fromDateRequired")}>
                  <input
                    required
                    type="date"
                    value={vacForm.start_date}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, start_date: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("toDateRequired")}>
                  <input
                    required
                    type="date"
                    value={vacForm.end_date}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, end_date: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("daysCountRequired")}>
                  <input
                    required
                    type="number"
                    min={1}
                    value={vacForm.days}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, days: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label={t("status")}>
                  <select
                    value={vacForm.status ?? "pending"}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, status: e.target.value })
                    }
                  >
                    <option value="pending">{t("pendingStatus")}</option>
                    <option value="approved">{t("approvedStatus")}</option>
                    <option value="rejected">{t("rejectedStatus")}</option>
                  </select>
                </Field>
                <Field label={t("notes")}>
                  <input
                    value={vacForm.notes ?? ""}
                    onChange={(e) =>
                      setVacForm({ ...vacForm, notes: e.target.value })
                    }
                  />
                </Field>
                <div className="form-actions">
                  <button type="submit" className="btn primary">
                    {editingVac ? t("saveChanges") : t("addVacationBtn")}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditingVac(null)}
                  >
                    {t("cancel")}
                  </button>
                </div>
              </form>
            )}

            <div className="stmt-table-wrap">
              <table className="table stmt-table">
                <thead>
                  <tr>
                    <th>{t("vacationTypeLabel")}</th>
                    <th>{t("fromLabel")}</th>
                    <th>{t("toLabel")}</th>
                    <th>{t("daysCountHeader")}</th>
                    <th>{t("status")}</th>
                    <th>{t("notes")}</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vacations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty">
                        {t("noVacationsRecorded")}
                      </td>
                    </tr>
                  )}
                  {vacations.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span
                          className={`stmt-type-badge ${
                            v.type === "sick" ? "type-payment" : "type-sale"
                          }`}
                        >
                          {t(VACATION_TYPES[v.type ?? "annual"] ?? v.type)}
                        </span>
                      </td>
                      <td>{fmtDate(v.start_date)}</td>
                      <td>{fmtDate(v.end_date)}</td>
                      <td className="strong">{v.days} {t("daysUnit")}</td>
                      <td>
                        <span
                          className={`pay-badge ${
                            v.status === "approved"
                              ? "card"
                              : v.status === "rejected"
                                ? "credit"
                                : "cash"
                          }`}
                        >
                          {t(VACATION_STATUS[v.status ?? "pending"] ?? v.status)}
                        </span>
                      </td>
                      <td>{v.notes ?? "—"}</td>
                      <td>
                        <button
                          className="btn sm stmt-edit-btn"
                          onClick={() => editVacation(v)}
                          title={t("edit")}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn sm danger"
                          onClick={() => removeVacation(v)}
                          title={t("delete")}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
