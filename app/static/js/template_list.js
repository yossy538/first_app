document.addEventListener("DOMContentLoaded", () => {
    // 🔽 テンプレート一覧取得部分（そのままでOK）
    fetch("/api/templates")
      .then(res => res.json())
      .then(data => {
        const list = document.getElementById("template-list");
  
        if (!data || data.length === 0) {
          list.innerHTML = "<p>テンプレートがありません</p>";
          return;
        }
  
        const ul = document.createElement("ul");
        ul.className = "template-list";
  
        data.forEach(t => {
          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${t.template_name}</strong><br>
            <div class="template-meta">カテゴリ：${t.category || "未分類"}</div>
            <div class="template-meta">案件名：${t.project_name || "ー"}｜お客様名：${t.customer_name || "ー"}</div>
            <div class="template-buttons">
              <button onclick="loadTemplate(${t.id})">📋 再利用</button>
              <button onclick="editTemplate(${t.id})">✏️ 編集</button>
              <button onclick="duplicateTemplate(${t.id})">📄 複製</button>
              <button onclick="deleteTemplate(${t.id})">🗑️ 削除</button>
            </div>
          `;
          ul.appendChild(li);
        });
  
        list.appendChild(ul);
      });
  
    // ✅ イベント登録（アップロードフォーム）
    const uploadForm = document.getElementById("upload-form");
    if (uploadForm) {
      uploadForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const formData = new FormData(this);
  
        fetch("/api/upload_template_excel", {
          method: "POST",
          body: formData,
        })
          .then((res) => res.json())
          .then((data) => {
            alert("✅ テンプレート化成功！");
            location.reload();
          })
          .catch((err) => {
            alert("❌ アップロードに失敗しました");
            console.error(err);
          });
      });
    }
  
    // 🔁 その他関数
    window.loadTemplate = function(id) {
      window.location.href = `/?template_id=${id}`;
    };
  
    window.editTemplate = function(id) {
      window.location.href = `/?template_id=${id}&mode=edit`;
    };
  
    window.duplicateTemplate = function(id) {
      const newName = prompt("複製するテンプレートの名前を入力してください:");
      if (!newName) return;
  
      fetch(`/api/templates/${id}`)
        .then(res => res.json())
        .then(template => {
          const payload = {
            template_name: newName,
            project_name: template.project_name,
            customer_name: template.customer_name,
            target_profit_rate: template.target_profit_rate,
            details: template.details
          };
  
          return fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        })
        .then(res => res.json())
        .then(result => {
          if (result.message) {
            alert("✅ 複製しました！");
            location.reload();
          } else {
            alert("❌ 複製に失敗しました");
          }
        })
        .catch(err => {
          console.error("複製エラー:", err);
          alert("❌ 複製中にエラーが発生しました");
        });
    };
  
    window.deleteTemplate = function(id) {
      const confirmed = confirm("本当に削除してもよろしいですか？");
      if (!confirmed) return;
  
      fetch(`/api/templates/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(result => {
          if (result.message) {
            alert("🗑️ 削除しました！");
            location.reload();
          } else {
            alert("❌ 削除に失敗しました");
          }
        })
        .catch(err => {
          console.error("削除エラー:", err);
          alert("❌ 削除中にエラーが発生しました");
        });
    };
  });
  