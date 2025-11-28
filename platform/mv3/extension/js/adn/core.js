/*******************************************************************************
    AdNauseam MV3 - Ad collection and clicking for uBlock Lite
*******************************************************************************/

// Ad storage and clicking logic
const adnauseam = {
  
  // Save ad to vault
  async saveAd(ad) {
    const { vault = [], stats = { totalAds: 0, totalClicks: 0 } } = 
      await chrome.storage.local.get(['vault', 'stats']);
    
    // Add to vault
    vault.push({
      ...ad,
      foundTs: Date.now(),
      clicked: false
    });
    
    stats.totalAds++;
    
    // Save
    await chrome.storage.local.set({ vault, stats });
    
    console.log('[ADN] Ad saved to vault:', ad);
    return ad;
  },
  
  // Click an ad
  async clickAd(ad, method = 'fetch') {
    console.log(`[ADN] Clicking ad via ${method}:`, ad.targetUrl);
    
    try {
      if (method === 'fetch') {
        // Silent fetch (no cookies)
        await fetch(ad.targetUrl, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          credentials: 'omit'
        });
      } else {
        // Hidden tab (realistic, has cookies)
        const tab = await chrome.tabs.create({
          url: ad.targetUrl,
          active: false
        });
        
        // Close after 2 seconds
        setTimeout(() => chrome.tabs.remove(tab.id), 2000);
      }
      
      await this.markAdClicked(ad.id);
      return true;
    } catch (error) {
      console.error('[ADN] Click failed:', error);
      return false;
    }
  },
  
  // Mark ad as clicked
  async markAdClicked(adId) {
    const { vault = [], stats = { totalAds: 0, totalClicks: 0 } } = 
      await chrome.storage.local.get(['vault', 'stats']);
    
    const adIndex = vault.findIndex(a => a.id === adId);
    if (adIndex !== -1) {
      vault[adIndex].clicked = true;
      vault[adIndex].clickedTs = Date.now();
    }
    
    stats.totalClicks++;
    
    await chrome.storage.local.set({ vault, stats });
  },
  
  // Get stats
  async getStats() {
    const { vault = [], stats = { totalAds: 0, totalClicks: 0 } } = 
      await chrome.storage.local.get(['vault', 'stats']);
    
    return {
      stats,
      vaultSize: vault.length
    };
  }
};

export { adnauseam };