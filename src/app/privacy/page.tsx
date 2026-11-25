import Link from "next/link";

export const metadata = { title: "隱私權政策" };

const CONTACT_EMAIL = "yubo0826@gmail.com";
const UPDATED = "2026 年 11 月 25 日";

/**
 * 隱私權政策（網站與 Chrome 擴充元件共用，商店上架要填這頁的網址）。
 * 內容要與實際行為一致：改了收集的資料（schema、localStorage、擴充元件權限）時一併更新這頁與 UPDATED。
 */
export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-6 text-base leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">隱私權政策</h1>
        <p className="text-sm text-muted-foreground">最後更新：{UPDATED}</p>
      </header>

      <p>
        本政策說明 Moji 單字本網站（moji.chouboyu.com）與「Moji 單字本」Chrome 擴充元件會收集哪些資料、如何使用，以及您可以如何管理或刪除這些資料。
        Moji 不放廣告、不使用第三方追蹤或分析工具，也不會出售或出租您的資料。
      </p>

      <section>
        <h2>一、我們收集的資料</h2>
        <p>
          <strong>帳號資料</strong>（註冊或登入時）
        </p>
        <ul>
          <li>以 Email 註冊：Email、暱稱，以及經雜湊處理的密碼（我們無法得知您的原始密碼）。</li>
          <li>以 Google 登入：Google 提供的姓名、Email、大頭貼網址與帳號識別碼，以及登入用的授權權杖。我們不會讀取您 Google 帳號中的其他資料。</li>
          <li>登入工作階段：為了讓您保持登入並保護帳號安全，會記錄登入時的 IP 位址與瀏覽器資訊（User-Agent）。</li>
        </ul>
        <p>
          <strong>學習資料</strong>（登入後由您建立）
        </p>
        <ul>
          <li>收藏的單字、單字本、筆記與熟悉度。</li>
          <li>複習紀錄：每張字卡的排程、作答結果、作答時間與花費時間。</li>
          <li>複習設定（例如每日新字數、時區）。</li>
          <li>查字歷史：您在網站上查過的單字與查詢時間，用於搜尋框的「最近查過」。</li>
        </ul>
        <p>
          <strong>只存在您瀏覽器裡的資料</strong>
        </p>
        <ul>
          <li>深色／淺色模式、美式／英式發音的選擇，存在瀏覽器的 localStorage。</li>
          <li>未登入時的查字歷史也只存在瀏覽器；登入後會合併到您的帳號。</li>
        </ul>
      </section>

      <section>
        <h2>二、Chrome 擴充元件</h2>
        <ul>
          <li>
            擴充元件需要在所有網頁上執行，才能在您選取文字時顯示查字卡片。它<strong>只在您主動查字時</strong>（選取文字後按 Alt，或按右鍵選「在
            Moji 查詢」）把選取的文字傳送到 Moji 網站查詢。
          </li>
          <li>擴充元件不會讀取、記錄或傳送您瀏覽的網址、網頁內容或瀏覽紀錄。</li>
          <li>透過擴充元件查字卡片查詢的單字不會寫入您的查字歷史；開啟 Moji 完整頁面後，則與在網站上查字相同。</li>
          <li>擴充元件的 storage 權限只用來保存 Moji 網站網址這一項設定。</li>
          <li>擴充元件從 Chrome 取得的資料，其使用方式遵守 Chrome 線上應用程式商店使用者資料政策（Chrome Web Store User Data Policy），包括「有限使用」（Limited Use）規定。</li>
        </ul>
      </section>

      <section>
        <h2>三、資料的用途</h2>
        <ul>
          <li>提供查字、收藏、筆記與間隔重複複習等功能，並在您的各個裝置間同步。</li>
          <li>維持登入狀態、防止帳號被盜用。</li>
          <li>排除錯誤與維護服務運作。</li>
        </ul>
        <p>我們不會把您的資料用於廣告、建立行銷檔案，或用來訓練 AI 模型。</p>
      </section>

      <section>
        <h2>四、資料的儲存與第三方服務</h2>
        <ul>
          <li>網站與資料庫架設在 Railway（新加坡區域）。Railway 作為主機服務商，會保存一般的伺服器存取紀錄（例如 IP 位址與請求網址）。</li>
          <li>使用 Google 登入時，登入流程由 Google 處理，並適用 Google 的隱私權政策。</li>
          <li>
            發音使用瀏覽器內建的語音合成功能。依您的瀏覽器與所選語音，瀏覽器可能把要朗讀的單字或例句傳送給瀏覽器廠商的語音服務（例如 Chrome
            的 Google 語音）處理。
          </li>
        </ul>
        <p>除了上述服務商，以及法律要求的情況以外，我們不會把您的資料提供給任何第三方。</p>
      </section>

      <section>
        <h2>五、Cookie</h2>
        <p>網站只使用維持登入所必需的 Cookie，不使用廣告或追蹤用的 Cookie。</p>
      </section>

      <section>
        <h2>六、您的權利：查看、匯出與刪除</h2>
        <ul>
          <li>您可以隨時在網站上查看、修改或刪除收藏、筆記與單字本。</li>
          <li>
            可以在<Link href="/wordbooks">管理單字本</Link>匯出收藏的單字。
          </li>
          <li>
            可以在<Link href="/account">帳號</Link>頁面刪除帳號。刪除後，帳號資料與所有學習資料都會從資料庫永久刪除，無法復原。
          </li>
          <li>
            為了跨裝置同步，您刪除的個別項目（例如移除的收藏）會先標記為已刪除，並在刪除帳號時一併永久清除。如果想提前完全清除，請來信告知。
          </li>
        </ul>
      </section>

      <section>
        <h2>七、資料安全</h2>
        <p>網站全程使用 HTTPS 加密連線，密碼經雜湊後才儲存，每次讀寫學習資料都只限定登入者本人的資料。</p>
      </section>

      <section>
        <h2>八、政策變更</h2>
        <p>若本政策有重大變更，會更新本頁的「最後更新」日期，並在網站上公告。</p>
      </section>

      <section>
        <h2>九、聯絡我們</h2>
        <p>
          對本政策或您的資料有任何疑問，或想要求查看、刪除資料，請寄信至{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
        </p>
      </section>
    </article>
  );
}
