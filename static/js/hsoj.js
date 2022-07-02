function login() {
  var username = $("#username").val();
  var password = $("#password").val();
  if (username == "" || password == "") {
    return;
  }
  $.post("/login", { username: username, password: password }, function (res) {
    console.log(res);
    if (res.success) {
      location.reload();
    } else {
      $("#mdui-textfield-password").addClass("mdui-textfield-invalid");
      $("#password-error").html(res.message);
    }
  });
}

function rerender() {
  hljs.highlightAll();
  renderMathInElement($("body")[0], {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    ignoredClasses: ["nokatex"],
  });
}
