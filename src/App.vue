<template>
  <div id="app">
    <nav class="side-nav">
      <div class="nav-brand">MoneyMan</div>
      <router-link to="/" class="nav-item">首頁</router-link>
      <router-link to="/add" class="nav-item">記帳</router-link>
      <router-link to="/report" class="nav-item">報表</router-link>
      <router-link to="/cards" class="nav-item">卡片</router-link>
      <router-link to="/reconcile" class="nav-item">對帳</router-link>
      <router-link to="/settings" class="nav-item">設定</router-link>
    </nav>
    <nav class="top-nav">
      <span class="top-brand">MoneyMan</span>
      <div class="top-links">
        <router-link to="/" class="nav-item">首頁</router-link>
        <router-link to="/add" class="nav-item">記帳</router-link>
        <router-link to="/report" class="nav-item">報表</router-link>
        <router-link to="/cards" class="nav-item">卡片</router-link>
        <router-link to="/reconcile" class="nav-item">對帳</router-link>
        <router-link to="/settings" class="nav-item">設定</router-link>
      </div>
    </nav>
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
#app { display: flex; min-height: 100vh; }

/* === Desktop: left sidebar === */
.side-nav {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 180px;
  display: flex; flex-direction: column;
  background: #1a1a2e; padding: 16px 0;
  z-index: 100;
}
.nav-brand {
  color: #4CAF50; font-size: 18px; font-weight: bold;
  padding: 12px 20px 24px;
}
.side-nav .nav-item {
  text-decoration: none; color: #aaa;
  font-size: 14px; padding: 10px 20px;
  transition: background 0.2s, color 0.2s;
}
.side-nav .nav-item:hover { background: rgba(255,255,255,0.05); color: #ddd; }
.side-nav .nav-item.router-link-active {
  color: #4CAF50; font-weight: bold;
  background: rgba(76,175,80,0.1);
  border-left: 3px solid #4CAF50;
}
.app-content { margin-left: 180px; padding: 24px; flex: 1; }

/* === Mobile: top nav hidden by default === */
.top-nav { display: none; }

/* === RWD breakpoint: 768px === */
@media (max-width: 768px) {
  #app { flex-direction: column; }
  .side-nav { display: none; }
  .top-nav {
    display: flex; align-items: center; gap: 8px;
    position: sticky; top: 0;
    background: #1a1a2e; padding: 10px 12px;
    z-index: 100;
  }
  .top-brand {
    color: #4CAF50; font-weight: bold; font-size: 15px;
    margin-right: 8px;
  }
  .top-links { display: flex; gap: 4px; }
  .top-nav .nav-item {
    text-decoration: none; color: #aaa;
    font-size: 13px; padding: 6px 10px;
    border-radius: 6px;
  }
  .top-nav .nav-item:hover { background: rgba(255,255,255,0.1); }
  .top-nav .nav-item.router-link-active {
    color: #4CAF50; font-weight: bold;
    background: rgba(76,175,80,0.15);
  }
  .app-content { margin-left: 0; padding: 16px; }
}
</style>
