const fallbackConfig = {
  version: "2.1.5, 2.1.6, 2.1.7, 2.1.8, 2.1.9, 2.2.0, 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.2.7, 2.2.8, 2.2.9, 2.3.0",
  hash: "pmjfhrekwfjaaeetwl23kfssseew34k2e",
  selectors: {
    expandSidebar: "div[data-slot=\"sidebar-header\"] button:not(:has(path[d^=\"M11.5 9.875c.898 0 1.625.727 \"]))",
    openNavSidebar: "div[data-slot=\"sidebar-header\"] button:not(:has(path[d^=\"M11.5 9.875c.898 0 1.625.727 \"]))",
    fileInput: "input[type=\"file\"]",
    modeButton: "div > button[role=\"combobox\"]:eq(0)",
    imageUploading: "button > img.opacity-70",
    imageModeItem: "div[role=\"presentation\"] > div[role=option]:eq(0)",
    videoModeItem: "div[role=\"presentation\"] > div[role=option]:eq(1)",
    promptContentEditable: "div[contenteditable='true']",
    promptContentEditableEditImage: "div[data-state='open'] textarea:last()",
    sendEditImageButton: "div[data-state=\"open\"] button:has(path[d^=\"M13 7.414V19a1 1 0 1 1-2 0V7.414l-3.293\"])",
    latestChatSidebar: "div[data-slot=\"sidebar-content\"] li[data-slot=\"sidebar-menu-item\"]:eq(0) a",
    loadingOutputElement: "button:has(path[d^=\"M19.1 5.625c1.105 0 1.988 0 2.699.058.72.059 1.342.182 1.914.473a4.877 4.877 0 0 1 2.13\"]), div.group\\/media-item canvas",
    latestOutputContainer: "div[data-message-item=\"true\"]:last()",
    editImageButton: "div[data-message-item=\"true\"]:last() a[href*=\"create/\"]:first()",
    closeEditImageModal: "div.absolute > div > button:has(path[d^=\"M22.88 24.12a.877.877 0 0 0 1.239-1.239l\"])"
  }
};

function t(t,n){return true}
let n=null;
async function e(t){const n=await fetch(`${t}/config/meta-automation`,{method:"GET",headers:{"X-Client-Secret":"YES_THAT_IS_VERY_EASY_RIGHT_?!"}});if(!n.ok)throw new Error(`HTTP ${n.status}`);const e=await n.json();if(!e?.selectors)throw new Error("Invalid config shape");return e}
async function r(){if(n)return n;try{return n=await e("https://configs.kylenguyen.me"),n}catch(t){}try{return n=await e("https://configs2.kylenguyen.me"),n}catch(t){}return n=fallbackConfig,n}
export{r as g,t as i};
