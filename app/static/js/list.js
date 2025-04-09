console.log("list.js 読み込み完了！");

document.addEventListener("DOMContentLoaded", function () {
  console.log("list.html DOMContentLoaded!");

  function formatActionButtons(cell, formatterParams, onRendered) {
    return `
      <button class="edit-btn" style="margin-right:5px;">✏️ 編集</button>
      <button class="delete-btn">🗑 削除</button>
    `;
  }

  const table = new Tabulator("#estimate-list-table", {
    layout: "fitColumns",
    height: "600px",
    ajaxURL: "/api/estimates",
    columns: [
        {title: "ID", field: "id"},
        {title: "案件名", field: "project_name"},
        {title: "お客様名", field: "customer_name"},
        {title: "売価合計", field: "total_list_price", formatter: "money"},
        {
          title: "操作",
          field: "actions",
          formatter: formatActionButtons,
          width:300,
          hozAlign:"center",
          cellClick: function(e, cell){
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
                fetch(`/api/estimates/${rowData.id}`, {method: "DELETE"})
                  .then(res => res.json())
                  .then(result => {
                    if (result.message) {
                      alert("✅ 削除しました！");
                      cell.getTable().replaceData(); // 再読み込み！
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
          }
        }
      ]
      
  });
});
