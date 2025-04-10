let detailTable;

// URLからedit_idを取得
function getEditIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('edit_id');
}

// ページが読み込まれたら実行
document.addEventListener("DOMContentLoaded", () => {
  console.log("ページが完全に読み込まれました！");

  initializeDetailTable()
    .then(() => {
      console.log("Tabulator初期化完了！");
      initializeButtons();

      const editId = getEditIdFromUrl();
      if (editId) {
        console.log("編集モード開始: edit_id =", editId);
        loadEstimateData(editId);
      }
    })
    .catch((error) => {
      console.error("Tabulator初期化エラー:", error);
    });
});

// Tabulator初期化
function initializeDetailTable() {
  return new Promise((resolve, reject) => {
    detailTable = new Tabulator("#tabulator-table", {
      layout: "fitColumns",
      height: "400px",
      reactiveData: true,
      columns: [
        { title: "項目", field: "item", editor: "input" },
        { title: "品番・型番", field: "model", editor: "input" },
        { title: "数量", field: "quantity", editor: "number", bottomCalc: "sum" },
        { title: "単位", field: "unit", editor: "input" },
        { title: "原価（仕入れ）", field: "cost_price", editor: "number", bottomCalc: "sum" },
        { title: "売価（単価）", field: "sale_price", editor: "number", bottomCalc: "sum" },
        { title: "原価小計", field: "cost_subtotal", bottomCalc: "sum", formatter: cell => Math.round(cell.getValue() || 0).toLocaleString() },
        { title: "小計（売価）", field: "subtotal", bottomCalc: "sum", formatter: cell => Math.round(cell.getValue() || 0).toLocaleString() },
      ],
      cellEdited: onCellEdited,
      dataChanged: updateTotals,
    });
    resolve();
  });
}

// フォームに見積データを読み込む
function loadEstimateData(editId) {
  fetch(`/api/estimates/${editId}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("project-name").value = data.project_name || "";
      document.getElementById("customer-name").value = data.customer_name || "";
    })
    .then(() => fetch(`/api/estimate_details/${editId}`))
    .then(res => res.json())
    .then(details => {
      detailTable.replaceData(details.map(d => ({
        item: d.item,
        model: d.model,
        quantity: d.quantity,
        unit: d.unit,
        cost_price: d.cost_price,
        sale_price: d.sale_price,
        cost_subtotal: d.cost_subtotal,
        subtotal: d.subtotal,
      })));
      detailTable._editingEstimateId = editId; // 編集モード判定に使う
    })
    .catch(error => {
      console.error("編集データ取得エラー:", error);
    });
}

// 保存処理
function saveEstimate() {
  const data = detailTable.getData();
  if (data.length === 0) {
    alert("保存するデータがありません！");
    return;
  }

  const editId = getEditIdFromUrl();
  const url = editId ? `/api/estimates/${editId}` : "/api/estimates";
  const method = editId ? "PUT" : "POST";

  let total_cost = 0;
  let total_list_price = 0;
  let quantity = 0;

  const details = data.map(row => {
    const qty = row.quantity || 0;
    const cost = row.cost_price || 0;
    const sale = row.sale_price || 0;
    quantity += qty;
    total_cost += qty * cost;
    total_list_price += qty * sale;

    return {
      item: row.item || "",
      model: row.model || "",
      quantity: qty,
      unit: row.unit || "",
      cost_price: cost,
      sale_price: sale,
      cost_subtotal: qty * cost,
      subtotal: qty * sale,
    };
  });

  const payload = {
    project_name: document.getElementById("project-name").value || "未入力案件",
    customer_name: document.getElementById("customer-name").value || "未入力顧客",
    total_cost,
    total_list_price,
    quantity,
    details,
  };

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(result => {
      if (result.message) {
        alert(editId ? "✏️ 更新完了！" : "✅ 新規保存完了！");
        window.location.href = "/list"; // 保存後はリスト画面へ移動
      } else {
        alert("❌ 保存に失敗しました…");
      }
    })
    .catch(error => {
      alert("❌ 通信エラー");
      console.error("通信エラー:", error);
    });
}

// 合計計算
function updateTotals() {
  const data = detailTable.getData();
  let totalCost = 0;
  let totalSale = 0;

  data.forEach(row => {
    totalCost += (row.quantity || 0) * (row.cost_price || 0);
    totalSale += (row.quantity || 0) * (row.sale_price || 0);
  });

  const profit = totalSale - totalCost;
  const profitRate = totalSale > 0 ? ((profit / totalSale) * 100).toFixed(1) : "0";

  document.getElementById("total-cost").textContent = `¥${totalCost.toLocaleString()}`;
  document.getElementById("total-sale").textContent = `¥${totalSale.toLocaleString()}`;
  document.getElementById("profit").textContent = `¥${profit.toLocaleString()}`;
  document.getElementById("profit-rate").textContent = `${profitRate}%`;
}

// セル編集時
function onCellEdited(cell) {
  const field = cell.getField();
  const data = cell.getRow().getData();

  if (field === "cost_price" || field === "quantity" || field === "sale_price") {
    cell.getRow().update({
      cost_subtotal: (data.quantity || 0) * (data.cost_price || 0),
      subtotal: (data.quantity || 0) * (data.sale_price || 0),
    });
    updateTotals();
  }
}

// ボタン初期化
function initializeButtons() {
  document.getElementById("add-row-btn").addEventListener("click", addNewRow);
  document.getElementById("save-btn").addEventListener("click", saveEstimate);
  document.getElementById("apply-profit-rate-btn").addEventListener("click", applyProfitRateToAllRows);
}

// 行を追加
function addNewRow() {
  detailTable.addRow({
    item: "",
    model: "",
    quantity: 1,
    unit: "",
    cost_price: 0,
    sale_price: 0,
    cost_subtotal: 0,
    subtotal: 0,
  });
}

// 目標利益率を再適用
function applyProfitRateToAllRows() {
  const targetProfitRate = parseFloat(document.getElementById("target-profit-rate").value) || 0;
  detailTable.getRows().forEach(row => {
    const data = row.getData();
    if (data.cost_price > 0) {
      const newSalePrice = Math.ceil(data.cost_price * (100 + targetProfitRate) / 100);
      row.update({
        sale_price: newSalePrice,
        cost_subtotal: (data.quantity || 0) * (data.cost_price || 0),
        subtotal: (data.quantity || 0) * newSalePrice,
      });
    }
  });
  updateTotals();
  alert("✅ 目標利益率を適用しました！");
}

