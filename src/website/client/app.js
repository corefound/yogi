const copyButtons = document.querySelectorAll("[data-copy]");
copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.querySelector(button.dataset.copy);
    const text = target?.innerText?.replace(/^Copy\s*/i, "").trim() || "";
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = old), 1200);
    } catch {
      button.textContent = "Copy failed";
      setTimeout(() => (button.textContent = "Copy"), 1200);
    }
  });
});

const installTabs = document.querySelectorAll("[data-install-tab]");
const installCommand = document.querySelector("#install-command");
const commands = {
  install: "$ yogi add @core/http",
  usage: "$ yogi run examples/http-client",
  cdn: '<script type="module" src="https://cdn.yogi.dev/@core/http"></script>'
};

installTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    installTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (installCommand) installCommand.innerHTML = `<span class="prompt">$</span> ${commands[tab.dataset.installTab].replace("$ ", "")}`;
  });
});
