<!-- ⚙️ Settings Modal -->
<div id="settingsModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
  <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">⚙️ Settings</h2>
      <button onclick="document.getElementById('settingsModal').classList.add('hidden')" class="text-gray-500 hover:text-red-500">✖</button>
    </div>

    <!-- Body -->
    <div class="divide-y dark:divide-gray-700">
      
      <!-- 1. Account -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">👤 Account</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Profile (name, photo, about)</li>
          <li>Phone number</li>
          <li>Change password</li>
        </ul>
      </div>

      <!-- 2. Wallet -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">💳 Wallet</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Balance</li>
          <li>Transactions history</li>
          <li>Add funds / Withdraw</li>
          <li>Pricing summary</li>
        </ul>
      </div>

      <!-- 3. Chats -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">💬 Chats</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Chat wallpaper</li>
          <li>Chat backup</li>
          <li>Clear all chats</li>
        </ul>
      </div>

      <!-- 4. Notifications -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">🔔 Notifications</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Choose from 20 built-in sounds</li>
          <li>Use custom music from device as ringtone</li>
          <li>Vibration toggle</li>
          <li>Popup notifications</li>
        </ul>
      </div>

      <!-- 5. Storage & Data -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">📦 Storage & Data</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Network usage</li>
          <li>Storage usage</li>
          <li>Media auto-download</li>
        </ul>
      </div>

      <!-- 6. Privacy & Security -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">🔒 Privacy & Security</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Last seen & online</li>
          <li>Profile photo</li>
          <li>Blocked contacts</li>
          <li>Two-step verification</li>
        </ul>
      </div>

      <!-- 7. Language -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">🌍 Language</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>Select preferred language</li>
        </ul>
      </div>

      <!-- 8. Help -->
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">❓ Help</h3>
        <ul class="space-y-2 text-gray-700 dark:text-gray-200">
          <li>FAQ</li>
          <li>Contact support</li>
          <li>Report a problem</li>
        </ul>
      </div>
    </div>
  </div>
</div>