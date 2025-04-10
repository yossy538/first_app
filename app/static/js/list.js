console.log("list.js 読み込み完了！");

document.addEventListener("DOMContentLoaded", function () {
  console.log("list.html DOMContentLoaded!");

  // 📌 プラスマイナス（展開）フォーマッター
  function plusMinusFormatter(cell, formatterParams) {
    const row = cell.getRow();
    return row.getElement().classList.contains("expanded") ? "−" : "+";
  }

  // 📌 操作ボタン（編集・削除）フォーマッター
  function formatActionButtons(cell, formatterParams) {
    return `
      <button class="edit-btn" style="margin-right:5px;">✏️ 編集</button>
      <button class="delete-btn">🗑 削除</button>
    `;
  }

  // 📌 明細を開く
  function expandRow(row) {
    collapseRow(row); // いったん全部閉じる

    const container = document.createElement("div");
    container.style.padding = "10px";
    container.style.background = "#f9f9f9";
    container.innerHTML = `<i>ここに明細データを出す予定！</i>`;

    const rowData = row.getData();

    fetch(`/api/estimate_details/${rowData.id}`)
      .then(res => res.json())
      .then(details => {
        if (details.length === 0) {
          container.innerHTML = "<i>明細データがありません</i>";
        } else {
          const list = document.createElement("ul");
          list.style.margin = "0";
          list.style.paddingLeft = "20px";

          details.forEach(d => {
            const li = document.createElement("li");
            li.textContent = `🛠 項目: ${d.item} / 品番: ${d.model} / 数量: ${d.quantity} / 単価: ¥${d.sale_price.toLocaleString()}`;
            list.appendChild(li);
          });

          container.appendChild(list);
        }

        row.getElement().appendChild(container);
        row.getElement().classList.add("expanded");

        // プラスをマイナスに変える
        const toggleCellElement = row.getElement().querySelector(".tabulator-cell:first-child");
        if (toggleCellElement) {
          toggleCellElement.innerText = "−";
        }
      })
      .catch(err => {
        console.error("明細取得エラー:", err);
        container.innerHTML = "<i>明細の取得に失敗しました…</i>";
        row.getElement().appendChild(container);
        row.getElement().classList.add("expanded");

        const toggleCellElement = row.getElement().querySelector(".tabulator-cell:first-child");
        if (toggleCellElement) {
          toggleCellElement.innerText = "−";
        }
      });
  }

  // 📌 明細を閉じる
  function collapseRow(row) {
    const containers = row.getElement().querySelectorAll("div");
    containers.forEach(c => {
      if (c.style && c.style.padding === "10px") {
        c.remove();
      }
    });

    row.getElement().classList.remove("expanded");

    // マイナスをプラスに戻す
    const toggleCellElement = row.getElement().querySelector(".tabulator-cell:first-child");
    if (toggleCellElement) {
      toggleCellElement.innerText = "+";
    }
  }

  // 📌 Tabulator 初期化
  const table = new Tabulator("#estimate-list-table", {
    layout: "fitColumns",
    height: "600px",
    ajaxURL: "/api/estimates",
    responsiveLayout: "collapse",
    columns: [
      {
        formatter: plusMinusFormatter,
        width: 40,
        hozAlign: "center",
        headerSort: false,
        cellClick: function (e, cell) {
          const row = cell.getRow();
          if (row.getElement().classList.contains("expanded")) {
            collapseRow(row);
          } else {
            expandRow(row);
          }
        }
      },
      { title: "ID", field: "id" },
      { title: "案件名", field: "project_name" },
      { title: "お客様名", field: "customer_name" },
      { title: "売価合計", field: "total_list_price", formatter: "money" },
      {
        title: "操作",
        field: "actions",
        formatter: formatActionButtons,
        width: 300,
        hozAlign: "center",
        cellClick: function (e, cell) {
          console.log("操作列クリック発動！！");
          const rowData = cell.getRow().getData();
          console.log("rowData:", rowData);

          if (e.target.classList.contains("edit-btn")) {
            console.log("✏️ 編集ボタン押された！");
            window.location.href = `/?edit_id=${rowData.id}`;
          }

          if (e.target.classList.contains("delete-btn")) {
            console.log("🗑 削除ボタン押された！");
            if (confirm("本当に削除してもいいですか？")) {
              fetch(`/api/estimates/${rowData.id}`, { method: "DELETE" })
                .then(res => res.json())
                .then(result => {
                  if (result.message) {
                    alert("✅ 削除しました！");
                    cell.getTable().replaceData();
                  } else {
                    alert("❌ 削除に失敗しました…");
                  }
                })
                .catch(err => {
                  alert("❌ 通信エラー");
                  console.error(err);
                });
            }
          }
        },
      },
    ],
  });

});
