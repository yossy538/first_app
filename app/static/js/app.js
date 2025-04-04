document.addEventListener("DOMContentLoaded", () => {
    let tableData = [];
  
    // ✅ Tabulatorテーブル作成
    const table = new Tabulator("#tabulator-table", {
      height: "400px",
      data: tableData,
      layout: "fitColumns",
      reactiveData: true,
      columns: [
        { title: "項目", field: "item", editor: "input" },
        { title: "品番・型番", field: "model", editor: "input" },
        { title: "数量", field: "quantity", editor: "number", bottomCalc: "sum" },
        { title: "単位", field: "unit", editor: "input" },
        { title: "原価（仕入れ）", field: "cost_price", editor: "number", bottomCalc: "sum" },
        { title: "売価（単価）", field: "sale_price", editor: "number", bottomCalc: "sum" },
        { title: "原価小計", field: "cost_subtotal", bottomCalc: "sum", formatter: "money" },
        { title: "小計（売価）", field: "subtotal", bottomCalc: "sum", formatter: "money" },
      ],
      cellEdited: function(cell) {
        const row = cell.getRow();
        const data = row.getData();
  
        if (["quantity", "cost_price", "sale_price"].includes(cell.getField())) {
          row.update({
            cost_subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.cost_price) || 0),
            subtotal: (parseFloat(data.quantity) || 0) * (parseFloat(data.sale_price) || 0),
          });
          updateTotals(); // ✅ 合計も更新
        }
      },
      dataChanged: () => updateTotals(),
    });
  
    // ✅ 合計更新関数
    function updateTotals() {
      const data = table.getData();
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
  
    // ✅ 行追加ボタン
    document.getElementById("add-row-btn").addEventListener("click", () => {
      table.addRow({
        item: "",
        model: "",
        quantity: 1,
        unit: "",
        cost_price: 0,
        sale_price: 0,
        cost_subtotal: 0,
        subtotal: 0,
      });
    });
  
    // ✅ 保存ボタン
    document.getElementById("save-btn").addEventListener("click", () => {
      const data = table.getData();
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
        total_cost: total_cost,
        total_list_price: total_list_price,
        quantity: quantity,
        details: details,
      };
  
      const estimateId = table._editingEstimateId || null;
      const url = estimateId ? `/api/estimates/${estimateId}` : "/api/estimates";
      const method = estimateId ? "PUT" : "POST";
  
      fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      .then(response => response.json())
      .then(result => {
        if (result.message) {
          alert(estimateId ? "✏️ 編集が完了しました！" : "✅ 新規見積を保存しました！");
          table._editingEstimateId = null;
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
    });
  
    // ✅ 保存済み見積一覧表示
    let listTable = null;
    function loadSavedEstimates() {
      fetch("/api/estimates")
        .then(response => response.json())
        .then(data => {
          if (listTable instanceof Tabulator) listTable.destroy();
          listTable = new Tabulator("#estimate-list-table", {
            height: "300px",
            data: data,
            layout: "fitColumns",
            columns: [
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
                title: "削除",
                formatter: "buttonCross",
                width: 100,
                hozAlign: "center",
                cellClick: (e, cell) => {
                    const row = cell.getRow().getData();
                    document.getElementById("project-name").value = row.project_name;
                    document.getElementById("customer-name").value = row.customer_name;
                  
                    // 🌟 サーバーから明細を取りに行く！
                    fetch(`/api/estimate_details/${row.id}`)
                      .then(res => res.json())
                      .then(details => {
                        table.replaceData(details.map(d => ({
                          item: d.item,
                          model: d.model,
                          quantity: d.quantity,
                          unit: d.unit,
                          cost_price: d.cost_price,
                          sale_price: d.sale_price,
                          cost_subtotal: d.cost_subtotal,
                          subtotal: d.subtotal,
                        })));
                  
                        table._editingEstimateId = row.id;
                        updateTotals();
                        alert(`🖊 ID: ${row.id} の見積を編集モードに切り替えました！`);
                      })
                      .catch(error => {
                        alert("明細データの取得に失敗しました…");
                        console.error("明細取得エラー:", error);
                      });
                  }
                  
                },
              
              {
                    title: "編集",
                    formatter: "buttonTick",
                    width: 100,
                    hozAlign: "center",
                  // 編集ボタン押した時
cellClick: (e, cell) => {
    const row = cell.getRow().getData();
    document.getElementById("project-name").value = row.project_name;
    document.getElementById("customer-name").value = row.customer_name;
  
    // 明細データをサーバーから取得
    fetch(`/api/estimate_details/${row.id}`)
      .then(res => res.json())
      .then(details => {
        table.replaceData(details.map(d => ({
          item: d.item,
          model: d.model,
          quantity: d.quantity,
          unit: d.unit,
          cost_price: d.cost_price,
          sale_price: d.sale_price,
          cost_subtotal: d.cost_subtotal,
          subtotal: d.subtotal,
        }))).then(() => {
          // 🌟ここが超大事🌟
          table.getRows().forEach(row => {
            row.getCells().forEach(cell => {
              if (["quantity", "cost_price", "sale_price"].includes(cell.getField())) {
                cell.getElement().addEventListener('blur', () => {
                  const rowData = row.getData();
                  row.update({
                    cost_subtotal: (parseFloat(rowData.quantity) || 0) * (parseFloat(rowData.cost_price) || 0),
                    subtotal: (parseFloat(rowData.quantity) || 0) * (parseFloat(rowData.sale_price) || 0),
                  });
                  updateTotals();
                });
              }
            });
          });
        });
  
        table._editingEstimateId = row.id;
        updateTotals();
        alert(`🖊 ID: ${row.id} の見積を編集モードに切り替えました！`);
      })
      .catch(error => {
        alert("明細データの取得に失敗しました…");
        console.error("明細取得エラー:", error);
      });
  }
  
                  }
                  
            ],
          });
        })
        .catch(error => {
          console.error("❌ 保存済み見積一覧の取得に失敗:", error);
        });
    }
  
    // ✅ 初期表示
    loadSavedEstimates();
  });
  