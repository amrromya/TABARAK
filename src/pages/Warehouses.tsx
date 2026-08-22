import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Field, Modal, money, qty, useToast } from "../components/ui";
import { t } from "../i18n";
import type { Warehouse, WarehouseStats } from "../types";

interface Row {
  warehouse: Warehouse;
  stats: WarehouseStats | null;
}

export function Warehouses() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Warehouse | null>(null);
  const [editName, setEditName] = useState("");
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const ws = await api.listWarehouses();
      const rws = await Promise.all(
        ws.map(async (w) => ({
          warehouse: w,
          stats: await api.warehouseStats(w.id).catch(() => null),
        })),
      );
      setRows(rws);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) {
      notify(t("enterWarehouseName"), "error");
      return;
    }
    try {
      const w = await api.createWarehouse(name.trim());
      notify(
        w.is_default
          ? `${t("warehouseAddedDefault")} "${w.name}"`
          : `${t("warehouseAdded")} "${w.name}"`,
      );
      setName("");
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!editName.trim()) {
      notify(t("enterWarehouseName"), "error");
      return;
    }
    try {
      await api.updateWarehouse(edit.id, editName.trim());
      notify(t("warehouseUpdated"));
      setEdit(null);
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const setDefault = async (id: number) => {
    try {
      await api.setDefaultWarehouse(id);
      notify(t("defaultWarehouseSet"));
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (w: Warehouse) => {
    if (
      !window.confirm(
        `${t("confirmDeleteWarehouse")} "${w.name}"? ${t("warehouseProductsNote")}`,
      )
    )
      return;
    try {
      await api.deleteWarehouse(w.id);
      notify(t("warehouseDeleted"));
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>{t("warehouses")}</h1>
        <span className="date-badge">{rows.length} {t("warehouseCount")}</span>
      </div>

      <div className="wh-row">
        <input
          placeholder={t("newWarehousePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button className="btn primary" onClick={add}>
          {t("addWarehouseBtn")}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="table-wrap">
          <p className="empty">
            {t("noWarehousesYet")}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("warehouse")}</th>
                <th>{t("quantity")}</th>
                <th>{t("inventoryValueCol")}</th>
                <th>{t("status")}</th>
                <th style={{ width: 240 }}>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ warehouse: w, stats }) => (
                <tr key={w.id}>
                  <td className="strong">{w.name}</td>
                  <td>{qty(stats?.quantity ?? 0)}</td>
                  <td>{money(stats?.value ?? 0)}</td>
                  <td>
                    {w.is_default ? (
                      <span className="pay-badge cash">{t("defaultWarehouse")}</span>
                    ) : (
                      <span className="pay-badge credit">{t("normalLabel")}</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {!w.is_default && (
                        <button
                          className="btn sm"
                          onClick={() => setDefault(w.id)}
                          title={t("setDefaultTitle")}
                        >
                          {t("setDefaultBtn")}
                        </button>
                      )}
                      <button
                        className="btn sm"
                        onClick={() => {
                          setEdit(w);
                          setEditName(w.name);
                        }}
                      >
                        {t("editBtnWarehouse")}
                      </button>
                      <button className="btn sm danger" onClick={() => remove(w)}>
                        {t("deleteBtnWarehouse")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="settings-note">
        {t("warehouseDefaultNote")}
      </p>

      {edit && (
        <Modal title={t("editWarehouseTitle")} onClose={() => setEdit(null)} width="400px">
          <Field label={t("warehouseNameField")}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
              }}
            />
          </Field>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEdit(null)}>
              {t("cancel")}
            </button>
            <button className="btn primary" onClick={saveEdit}>
              💾 {t("save")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
