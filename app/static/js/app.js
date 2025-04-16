let detailTable;
let table;  // グローバル変数としてTabulatorインスタンス用意
let isEdited = false;  // 🌟 編集されたかどうか記憶するグローバル変数！


// URLからedit_idを取得
function getEditIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('edit_id');
}

// 🔍 URLから template_id を取得する関数も追加
function getTemplateIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("template_id");
}

// ページが読み込まれたら実行
document.addEventListener("DOMContentLoaded", () => {
  console.log("ページが完全に読み込まれました！");

  initializeDetailTable()
  .then(() => {
    console.log("Tabulator初期化完了！");
    initializeButtons();

    const editId = getEditIdFromUrl();
    const templateId = getTemplateIdFromUrl();
    const mode = new URLSearchParams(window.location.search).get("mode");

    if (editId) {
      console.log("編集モード開始: edit_id =", editId);
      loadEstimateData(editId);

      fetch(`/api/estimate_details/${editId}`)
        .then(response => response.json())
        .then(details => {
          console.log("明細データ取得完了:", details);
          detailTable.setData(details);
          recalcProfitRates();
          updateTotals();
        })
        .catch(error => {
          console.error("明細データ取得エラー:", error);
        });

    } else if (templateId && mode === "edit") {
      console.log("✏️ テンプレート編集モード開始: template_id =", templateId);

      fetch(`/api/templates/${templateId}`)
        .then(res => res.json())
        .then(template => {
          document.getElementById("project-name").value = template.project_name || "";
          document.getElementById("customer-name").value = template.customer_name || "";
          document.getElementById("target-profit-rate").value = template.target_profit_rate || 30;

          if (template.details && Array.isArray(template.details)) {
            detailTable.setData(template.details);
            
          // 🔥 これで安全に！
            const rateInput = document.getElementById("target-profit-rate");
            if (rateInput) {
              applyProfitRateToAllRows();
            }

            recalcProfitRates();
            updateTotals();
          }

          alert("✏️ テンプレート編集モードです！");
        })
        .catch(err => {
          console.error("テンプレート読み込みエラー:", err);
          alert("❌ テンプレート読み込みに失敗しました");
        });

    } else if (templateId) {
      console.log("テンプレートから新規作成: template_id =", templateId);

      fetch(`/api/templates/${templateId}`)
        .then(res => res.json())
        .then(template => {
          document.getElementById("project-name").value = template.project_name || "";
          document.getElementById("customer-name").value = template.customer_name || "";
          document.getElementById("target-profit-rate").value = template.target_profit_rate || 30;

          if (template.details && Array.isArray(template.details)) {
            detailTable.setData(template.details);
            applyProfitRateToAllRows();
            recalcProfitRates();
            updateTotals();
          }

          alert("✅ テンプレートを読み込みました！");
        })
        .catch(err => {
          console.error("テンプレート読み込みエラー:", err);
          alert("❌ テンプレート読み込みに失敗しました");
        });
    }

  })
  .catch((error) => {
    console.error("Tabulator初期化エラー:", error);
  });

});


// ✅ 保存処理
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
        isEdited = false;

        // ✅ 保存完了後テンプレート保存する？
// ✅ 保存完了後テンプレート保存する？
const wantTemplate = confirm("テンプレートとしても保存しますか？");
if (wantTemplate) {
  const templateId = getTemplateIdFromUrl();
  const mode = new URLSearchParams(window.location.search).get("mode");

  if (mode === "edit" && templateId) {
    // ✏️ 編集モード → 上書き保存
    const confirmUpdate = confirm("このテンプレートを上書きしますか？");
    if (!confirmUpdate) return;

    const templatePayload = {
      template_name: "", // 空でもOK（Flask側で上書きしない）
      project_name: payload.project_name,
      customer_name: payload.customer_name,
      target_profit_rate: parseFloat(document.getElementById("target-profit-rate").value) || 0,
      details: payload.details
    };

    fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templatePayload)
    })
      .then(res => res.json())
      .then(result => {
        if (result.message) {
          alert("✏️ テンプレートを更新しました！");
          window.location.href = "/templates";
        } else {
          alert("❌ テンプレートの更新に失敗しました");
        }
      })
      .catch(err => {
        console.error("テンプレート更新エラー:", err);
        alert("❌ テンプレートの更新時にエラーが発生しました");
      });

  } else {
    // 🆕 新規作成
    const templateName = prompt("テンプレート名を入力してください:");
    if (!templateName) return;

    fetch("/api/templates")
      .then(res => res.json())
      .then(allTemplates => {
        const exists = allTemplates.some(t => t.template_name === templateName);
        if (exists) {
          alert("❌ そのテンプレート名は既に使われています。");
          return;
        }

        const templatePayload = {
          template_name: templateName,
          project_name: payload.project_name,
          customer_name: payload.customer_name,
          target_profit_rate: parseFloat(document.getElementById("target-profit-rate").value) || 0,
          details: payload.details
        };

        fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templatePayload)
        })
          .then(res => res.json())
          .then(result => {
            if (result.message) {
              alert("✅ テンプレートも保存しました！");
              window.location.href = "/list";
            } else {
              alert("❌ テンプレートの保存に失敗しました");
            }
          })
          .catch(err => {
            console.error("テンプレート保存エラー:", err);
            alert("❌ テンプレート保存時にエラーが発生しました");
          });
      });
  }
} else {
  window.location.href = "/list";
}


      } else {
        alert("❌ 保存に失敗しました…");
      }
    })
    .catch(error => {
      alert("❌ 通信エラー");
      console.error("通信エラー:", error);
    });
}

// ✅ 以下 unchanged: initializeDetailTable, updateTotals, recalcProfitRates, etc.



// Tabulator初期化
function initializeDetailTable() {
  return new Promise((resolve, reject) => {
    detailTable = new Tabulator("#tabulator-table", {
      layout: "fitColumns",
      height: "400px",
      reactiveData: true,
      columns: [
        { title: "項目", field: "item", editor: "input", minWidth: 160 },
        { title: "品番・型番", field: "model", editor: "input", minWidth: 160 },
        { title: "数量", field: "quantity", editor: "number", width: 80, bottomCalc: "sum", hozAlign: "right" },
        { title: "単位", field: "unit", editor: "input", width: 80 },
        { title: "原価（仕入れ）", field: "cost_price", editor: "number", width: 120, bottomCalc: "sum", hozAlign: "right" },
        { title: "売価（単価）", field: "sale_price", editor: "number", width: 120, bottomCalc: "sum", hozAlign: "right" },
        { 
          title: "原価小計", 
          field: "cost_subtotal", 
          width: 120,
          bottomCalc: "sum", 
          hozAlign: "right",
          formatter: cell => Math.round(cell.getValue() || 0).toLocaleString()
        },
        { 
          title: "小計（売価）", 
          field: "subtotal", 
          width: 120,
          bottomCalc: "sum", 
          hozAlign: "right",
          formatter: cell => Math.round(cell.getValue() || 0).toLocaleString()
        },
        { 
          title: "利益額", 
          field: "profit_amount",
          width: 120,
          formatter: (cell) => {
            const data = cell.getData();
            const costSubtotal = data.cost_subtotal || 0;
            const subtotal = data.subtotal || 0;
            const profit = subtotal - costSubtotal;
      
            if (profit < 0) {
              return `<span style="color: red;">¥${Math.round(profit).toLocaleString()}</span>`;
            } else {
              return `¥${Math.round(profit).toLocaleString()}`;
            }
          },
          bottomCalc: "sum",
          hozAlign: "right",
          headerSort: false
        },
        { 
          title: "利益率（%）", 
          field: "profit_rate",
          width: 100,
          formatter: (cell) => {
            const data = cell.getData();
            const costPrice = data.cost_price || 0;
            const salePrice = data.sale_price || 0;
            let display = "-";
      
            if (salePrice > 0) {
              const profitRate = ((salePrice - costPrice) / salePrice) * 100;
              const formattedRate = profitRate.toFixed(1) + "%";
      
              if (profitRate < 0) {
                display = `<span style="color: red;">${formattedRate}</span>`;
              } else if (profitRate <= 20) {
                display = `<span style="color: orange;">${formattedRate}</span>`;
              } else {
                display = `<span style="color: black;">${formattedRate}</span>`;
              }
            }
            return display;
          },
          hozAlign: "center",
          headerSort: false
        },
        { 
          title: "操作", 
          width: 100,
          formatter: function(cell, formatterParams) {
            return `<button class="detail-delete-btn"><span class="delete-icon">❌</span></button>`;
          },
          hozAlign: "center",
          headerSort: false,
          cellClick: function(e, cell) {
            cell.getRow().delete();
          }
        }
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
        isEdited = false;  // 🌟ここに追加！！！
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

  // 💡合計数字を画面に出す
  document.getElementById("total-cost").textContent = `¥${totalCost.toLocaleString()}`;
  document.getElementById("total-sale").textContent = `¥${totalSale.toLocaleString()}`;
  document.getElementById("profit").textContent = `¥${profit.toLocaleString()}`;
  document.getElementById("profit-rate").textContent = `${profitRate}%`;

  // 🌟 色分けアラートをここでやる！！
  const profitElement = document.getElementById("profit");
  const profitRateElement = document.getElementById("profit-rate");

  if (profit < 0) {
    profitElement.style.color = "red";
  } else {
    profitElement.style.color = "black";
  }

  if (parseFloat(profitRate) < 0) {
    profitRateElement.style.color = "red";
  } else if (parseFloat(profitRate) <= 20) {
    profitRateElement.style.color = "orange";
  } else {
    profitRateElement.style.color = "black";
  }
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
    isEdited = true;
  }
}



// ✅ ボタン初期化
function initializeButtons() {
  document.getElementById("add-row-btn").addEventListener("click", addNewRow);
  document.getElementById("save-btn").addEventListener("click", saveEstimate);
  document.getElementById("apply-profit-rate-btn").addEventListener("click", applyProfitRateToAllRows);
  document.getElementById('recalc-profit-rate-btn').addEventListener('click', recalcProfitRates);

  // 🌟 保存済み一覧へ戻るボタンも警告制御
  document.getElementById("to-list-btn").addEventListener("click", function(e) {
    if (isEdited) {
      const confirmLeave = confirm("保存されていません。本当に一覧に戻りますか？");
      if (!confirmLeave) {
        e.preventDefault();
        return;
      }
    }
    window.location.href = "/list";
  });
}

// ✅ 行を追加する
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
  isEdited = true; // 🌟 行追加したら編集フラグON！
}

// ✅ 目標利益率を再適用
function applyProfitRateToAllRows() {
  const input = document.getElementById("target-profit-rate");
  if (!input) {
    console.warn("💡 target-profit-rate が見つからないため、利益率適用をスキップします");
    return;
  }

  const targetProfitRate = parseFloat(input.value) || 0;
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
  isEdited = true;
  // alert("✅ 目標利益率を適用しました！");
}


// ✅ 利益率＋利益額を再計算する
function recalcProfitRates() {
  const rows = detailTable.getRows();
  let hasNegativeProfit = false;  // 🌟 マイナス利益チェック用

  rows.forEach(row => {
    const data = row.getData();
    const costPrice = data.cost_price || 0;
    const salePrice = data.sale_price || 0;
    const quantity = data.quantity || 0;

    const costSubtotal = quantity * costPrice;
    const subtotal = quantity * salePrice;
    const profitAmount = subtotal - costSubtotal;

    if (profitAmount < 0) {
      hasNegativeProfit = true;  // 🌟 どこかで赤字あれば記録
    }

    let profitRate = "-";
    if (salePrice > 0) {
      profitRate = ((salePrice - costPrice) / salePrice) * 100;
      profitRate = profitRate.toFixed(1) + "%";
    }

    row.update({
      cost_subtotal: costSubtotal,
      subtotal: subtotal,
      profit_amount: profitAmount,
      profit_rate: profitRate,
    });
  });

  updateTotals();
  isEdited = true; // 🌟 再計算も編集扱いにしとく！
  console.log("✅ 明細利益率＋利益額＋小計金額＋合計すべて再計算しました！");

  // 🌟 再計算が終わったあとに赤字チェックしてアラート！
  if (hasNegativeProfit) {
    alert("⚠️ 利益額がマイナスになっている項目があります。内容を確認してください！");
  }
}


// ✅ セル編集時に編集フラグを立てる
function onCellEdited(cell) {
  const field = cell.getField();
  const data = cell.getRow().getData();

  if (field === "cost_price" || field === "quantity" || field === "sale_price") {
    cell.getRow().update({
      cost_subtotal: (data.quantity || 0) * (data.cost_price || 0),
      subtotal: (data.quantity || 0) * (data.sale_price || 0),
    });
    updateTotals();
    isEdited = true; // 🌟 何か変更があったら保存警告出す
  }
}

// ✅ ページ離脱時にアラート出す
window.addEventListener('beforeunload', function (e) {
  if (isEdited) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.getElementById("save-template-btn").addEventListener("click", () => {
  const templateId = getTemplateIdFromUrl();
  const isEditMode = new URLSearchParams(window.location.search).get("mode") === "edit";

  const templateName = isEditMode ? null : prompt("保存するテンプレート名を入力してください:");
  if (!templateId && !templateName) return;

  const projectName = document.getElementById("project-name").value;
  const customerName = document.getElementById("customer-name").value;
  const targetProfitRate = parseFloat(document.getElementById("target-profit-rate").value) || 0;
  const category = document.getElementById("template-category")?.value || "";  // ← 追加！
  const details = detailTable.getData();
  
  const payload = {
    template_name: templateName,
    project_name: projectName,
    customer_name: customerName,
    target_profit_rate: targetProfitRate,
    category: category,  // ← OK！
    details: details
  };
  

  // ✅ 編集モードなら PUT、通常は POST
  const url = isEditMode ? `/api/templates/${templateId}` : "/api/templates";
  const method = isEditMode ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(result => {
      if (result.message) {
        alert(isEditMode ? "✏️ テンプレートを更新しました！" : "✅ テンプレートを保存しました！");
        window.location.href = "/templates";
      } else {
        alert("❌ テンプレートの保存に失敗しました");
      }
    })
    .catch(error => {
      console.error("テンプレート保存エラー:", error);
      alert("❌ 通信エラーが発生しました");
    });
});
