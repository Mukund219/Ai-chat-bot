(function () {
  const vscode = acquireVsCodeApi();
  const chatContainer = document.getElementById("chatContainer");
  const questionInput = document.getElementById("questionInput");
  const codeContext = document.getElementById("codeContext");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");
  const quickBtns = document.querySelectorAll(".quick-btn");

  let isLoading = false;

  // Initialize
  function init() {
    sendBtn.addEventListener("click", handleSend);
    questionInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    clearBtn.addEventListener("click", clearChat);

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () =>
        handleQuickAction(btn.dataset.action)
      );
    });

    // Load previous state if exists
    const state = vscode.getState();
    if (state && state.messages) {
      state.messages.forEach((msg) => addMessage(msg.type, msg.content, false));
    }
  }

  function handleSend() {
    const question = questionInput.value.trim();
    const code = codeContext.value.trim();

    if (!question && !code) return;
    if (isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    addMessage("user", question || "Code query");

    vscode.postMessage({
      command: "ask",
      question: question,
      code: code,
    });

    questionInput.value = "";
  }

  function handleQuickAction(action) {
    const code = codeContext.value.trim();
    if (!code) {
      addMessage("error", "Please paste some code in the context area first!");
      return;
    }

    isLoading = true;
    let message = "";

    switch (action) {
      case "explain":
        message = "Explain this code";
        vscode.postMessage({ command: "explain", code: code });
        break;
      case "debug":
        const error = prompt("Describe the error (optional):");
        message = `Debug this code${error ? ": " + error : ""}`;
        vscode.postMessage({
          command: "debug",
          code: code,
          error: error || "General debugging",
        });
        break;
      case "optimize":
        message = "Optimize this code";
        vscode.postMessage({ command: "optimize", code: code });
        break;
      case "test":
        message = "Generate tests for this code";
        vscode.postMessage({ command: "generateTests", code: code });
        break;
    }

    addMessage("user", message);
  }

  function addMessage(type, content, save = true) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    if (type === "user") {
      messageDiv.innerHTML = `
                <div class="message-header">👨‍💻 You</div>
                <div class="message-content">${escapeHtml(content)}</div>
            `;
    } else if (type === "assistant") {
      messageDiv.innerHTML = `
                <div class="message-header">🤖 Assistant</div>
                <div class="message-content">${formatContent(content)}</div>
            `;
    } else if (type === "error") {
      messageDiv.innerHTML = `
                <div class="error-message">❌ ${escapeHtml(content)}</div>
            `;
    } else if (type === "loading") {
      messageDiv.innerHTML = `
                <div class="loading">
                    <span class="loading-dots">Thinking</span>
                </div>
            `;
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Save state
    if (save && (type === "user" || type === "assistant")) {
      saveState();
    }
  }

  function formatContent(content) {
    if (typeof content === "object") {
      if (content.response) {
        return formatResponse(content.response);
      } else if (content.solution) {
        return formatResponse(content.solution);
      } else if (content.explanation) {
        return formatResponse(content.explanation);
      } else if (content.optimization) {
        return formatResponse(content.optimization);
      } else if (content.tests) {
        return formatResponse(content.tests);
      }
    }

    // Handle plain text with code blocks
    return formatTextWithCode(content);
  }

  function formatResponse(response) {
    let html = "";

    if (response.explanation) {
      html += `<div>${escapeHtml(response.explanation)}</div>`;
    }

    if (response.code_blocks && response.code_blocks.length > 0) {
      response.code_blocks.forEach((block) => {
        html += createCodeBlock(block.code, block.language);
      });
    }

    return html;
  }

  function formatTextWithCode(text) {
    // Replace code blocks with formatted HTML
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    return text
      .replace(codeBlockRegex, (match, lang, code) => {
        return createCodeBlock(code.trim(), lang || "plaintext");
      })
      .replace(/\n/g, "<br>");
  }

  function createCodeBlock(code, language) {
    const blockId =
      "code-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    return `
            <div class="code-block">
                <div class="code-block-header">
                    <span class="code-block-lang">${language}</span>
                    <button class="copy-btn" onclick="copyCode('${blockId}', this)">Copy</button>
                </div>
                <pre><code id="${blockId}">${escapeHtml(code)}</code></pre>
            </div>
        `;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function clearChat() {
    chatContainer.innerHTML = "";
    vscode.setState({ messages: [] });
  }

  function saveState() {
    const messages = Array.from(chatContainer.querySelectorAll(".message"))
      .filter(
        (msg) =>
          msg.classList.contains("user") || msg.classList.contains("assistant")
      )
      .map((msg) => ({
        type: msg.classList.contains("user") ? "user" : "assistant",
        content: msg.querySelector(".message-content").textContent,
      }));

    vscode.setState({ messages });
  }

  // Copy code function (global for onclick)
  window.copyCode = function (blockId, button) {
    const codeElement = document.getElementById(blockId);
    const code = codeElement.textContent;

    navigator.clipboard.writeText(code).then(() => {
      button.textContent = "Copied!";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = "Copy";
        button.classList.remove("copied");
      }, 2000);
    });
  };

  // Handle messages from extension
  window.addEventListener("message", (event) => {
    const message = event.data;

    // Remove loading message
    const loadingMsg = chatContainer.querySelector(".loading");
    if (loadingMsg) {
      loadingMsg.parentElement.remove();
    }

    switch (message.command) {
      case "response":
        addMessage("assistant", message.data);
        break;
      case "error":
        addMessage("error", message.error);
        break;
    }

    isLoading = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  });

  // Start
  init();
})();
