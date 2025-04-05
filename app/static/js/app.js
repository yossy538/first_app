let detailTable;
let listTable;

document.addEventListener("DOMContentLoaded", () => {
  initializeDetailTable();
  initializeButtons();
  loadSavedEstimates();
});

// ✅ 明細テーブル初期化
function initializeDetailTable() {
  detailTable = new Tabulator("#tabulator-table", {
    height: "400px",
    data: [],
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      { title: "項目", field: "item", editor: "input" },
      { title: "品番・型番", field: "model", editor: "input" },
      { title: "数量", field: "quantity", editor: "number", bottomCalc: "sum" },
      { title: "単位", field: "unit", editor: "input" },
      { title: "原価（仕入れ）", field: "cost_price", editor: "number", bottomCalc: "sum" },
      { title: "売価（単価）", field: "sale_price", editor: "number", bottomCalc: "sum" },
      { title: "原価小計", field: "cost_subtotal", bottomCalc: "sum", formatter: cell => Math.round(cell.getValue()).toLocaleString() },
      { title: "小計（売価）", field: "subtotal", bottomCalc: "sum", formatter: cell => Math.round(cell.getValue()).toLocaleString() },
    ],
    cellEdited: onCellEdited,
    dataChanged: updateTotals,
  });

  detailTable.on("cellEditBlur", onCellEditBlur);
}

// ✅ セル編集時
function onCellEdited(cell) {
  const field = cell.getField();
  const data = cell.getRow().getData();

  if (field === "cost_price") {
    const targetProfitRate = parseFloat(document.getElementById("target-profit-rate").value) || 0;
    const newSalePrice = Math.ceil(data.cost_price * (100 + targetProfitRate) / 100);
    cell.getRow().update({
      sale_price: newSalePrice,
      cost_subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.cost_price) || 0),
      subtotal: (parseFloat(data.quantity) || 0) * newSalePrice,
    });
  } else if (field === "sale_price" || field === "quantity") {
    // 🌟 sale_price または quantity 編集時も subtotal再計算する！
    cell.getRow().update({
      cost_subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.cost_price) || 0),
      subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.sale_price) || 0),
    });
  }

  updateTotals();
}





// ✅ セル編集後フォーカス外れたとき
function onCellEditBlur(e, cell) {
  const field = cell.getField();
  const data = cell.getRow().getData();

  if (field === "cost_price" || field === "quantity") {
    autoCalculateRow(cell.getRow(), data);
    updateTotals();
  }
}

// ✅ 行自動計算
function autoCalculateRow(row, data) {
  const targetProfitRate = parseFloat(document.getElementById("target-profit-rate").value) || 0;
  
  let salePrice = data.sale_price || 0;

  if (data.cost_price > 0) {
    salePrice = Math.ceil(data.cost_price * (100 + targetProfitRate) / 100);
  }

  row.update({
    sale_price: salePrice,
    cost_subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.cost_price) || 0),
    subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(salePrice) || 0),
  });
}


// ✅ 合計更新
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

// ✅ ボタン初期化
function initializeButtons() {
  document.getElementById("add-row-btn").addEventListener("click", addNewRow);
  document.getElementById("save-btn").addEventListener("click", saveEstimate);
  document.getElementById("apply-profit-rate-btn").addEventListener("click", applyProfitRateToAllRows); // ← これ追加！！
}


// ✅ 新しい行を追加
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

// ✅ 見積保存
function saveEstimate() {
  const data = detailTable.getData();
  if (data.length === 0) {
    alert("保存するデータがありません！");
    return;
  }

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

  const estimateId = detailTable._editingEstimateId || null;
  const url = estimateId ? `/api/estimates/${estimateId}` : "/api/estimates";
  const method = estimateId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(response => response.json())
    .then(result => {
      if (result.message) {
        alert(estimateId ? "✏️ 編集が完了しました！" : "✅ 新規見積を保存しました！");
        detailTable._editingEstimateId = null;
        updateTotals();
        loadSavedEstimates();
      } else {
        alert("❌ 保存に失敗しました…");
      }
    })
    .catch(error => {
      alert("❌ 通信エラー");
      console.error("通信エラー:", error);
    });
}

// ✅ 保存済み見積一覧ロード
function loadSavedEstimates() {
  fetch("/api/estimates")
    .then(response => response.json())
    .then(data => {
      if (listTable instanceof Tabulator) listTable.destroy();

      listTable = new Tabulator("#estimate-list-table", {
        height: "300px",
        data,
        layout: "fitColumns",
        responsiveLayout: "collapse",
        columns: [
          {
            title: "",
            formatter: cell => {
              const row = cell.getRow();
              return row._expanded ? "−" : "+";
            },
            width: 40,
            hozAlign: "center",
            headerSort: false,
            cellClick: (e, cell) => {
              const row = cell.getRow();
              row._expanded = !row._expanded;
              if (row._expanded) expandRow(row);
              else collapseRow(row);

              cell.getElement().innerHTML = row._expanded ? "−" : "+";
            },
          },
          { title: "ID", field: "id", width: 60 },
          { title: "案件名", field: "project_name" },
          { title: "顧客名", field: "customer_name" },
          { title: "原価", field: "total_cost", formatter: "money" },
          { title: "売価", field: "total_list_price", formatter: "money" },
          { title: "利益", field: "total_profit", formatter: "money" },
          {
            title: "利益率",
            field: "profit_rate_cost",
            formatter: cell => {
              const value = cell.getValue();
              return value !== undefined && value !== null && !isNaN(value)
                ? `${value.toFixed(1)}%`
                : "-";
            },
          },
          { title: "数量", field: "quantity" },
          {
            title: "編集",
            formatter: "buttonTick",
            width: 100,
            hozAlign: "center",
            cellClick: (e, cell) => editEstimate(cell.getRow().getData()),
          },
          {
            title: "削除",
            formatter: "buttonCross",
            width: 100,
            hozAlign: "center",
            cellClick: (e, cell) => {
              const row = cell.getRow().getData();
              if (confirm(`🗑 ID: ${row.id} の見積を削除しますか？`)) {
                fetch(`/api/estimates/${row.id}`, { method: "DELETE" })
                  .then(res => res.json())
                  .then(result => {
                    if (result.message) {
                      alert("✅ 削除しました！");
                      loadSavedEstimates();
                    } else {
                      alert("❌ 削除に失敗しました…");
                    }
                  })
                  .catch(error => {
                    alert("❌ 通信エラー");
                    console.error("削除エラー:", error);
                  });
              }
            },
          },
        ],
      });
    })
    .catch(error => {
      alert("❌ 見積リスト取得エラー");
      console.error("リスト取得エラー:", error);
    });
}

// ✅ 編集モード
function editEstimate(rowData) {
  document.getElementById("project-name").value = rowData.project_name;
  document.getElementById("customer-name").value = rowData.customer_name;

  fetch(`/api/estimate_details/${rowData.id}`)
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
      detailTable._editingEstimateId = rowData.id;
      updateTotals();
      alert(`🖊 ID: ${rowData.id} の見積を編集モードに切り替えました！`);
    })
    .catch(error => {
      alert("明細データの取得に失敗しました…");
      console.error("明細取得エラー:", error);
    });
}

// ✅ 折りたたみ展開
function expandRow(row) {
  collapseRow(row);

  const container = document.createElement("div");
  container.style.padding = "10px";
  container.style.background = "#f9f9f9";
  container.classList.add("expand-container");

  const rowData = row.getData();

  fetch(`/api/estimate_details/${rowData.id}`)
    .then(res => res.json())
    .then(details => {
      if (details.length === 0) {
        container.innerHTML = "<i>明細データがありません</i>";
        return;
      }

      const list = document.createElement("ul");
      list.style.margin = "0";
      list.style.paddingLeft = "20px";

      details.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `🛠 項目: ${d.item} / 品番: ${d.model} / 数量: ${d.quantity} / 単価: ¥${d.sale_price.toLocaleString()}`;
        li.style.marginBottom = "4px";
        list.appendChild(li);
      });

      container.appendChild(list);
    })
    .catch(err => {
      container.innerHTML = "<i>明細の取得に失敗しました…</i>";
      console.error(err);
    });

  row.getElement().appendChild(container);
}

// ✅ 折りたたみ閉じる
function collapseRow(row) {
  const expandElements = row.getElement().querySelectorAll(".expand-container");
  expandElements.forEach(el => el.remove());
}

// ✅ 目標利益率をすべてに再適用する関数
function applyProfitRateToAllRows() {
  const targetProfitRate = parseFloat(document.getElementById("target-profit-rate").value) || 0;
  const rows = detailTable.getRows();

  rows.forEach(row => {
    const data = row.getData();
    if (data.cost_price > 0) {
      const newSalePrice = Math.ceil(data.cost_price * (100 + targetProfitRate) / 100);
      row.update({
        sale_price: newSalePrice,
        cost_subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.cost_price) || 0),
        subtotal: (parseFloat(data.quantity) || 0) * newSalePrice,
      });
    }
  });

  updateTotals();
  alert("✅ 目標利益率をすべてに再適用しました！");
}

