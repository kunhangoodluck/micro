// ============================================================
//  南屯自走車 · 體驗版韌體（純按鈕、超慢、不會邊走邊轉）
//
//  安裝：新專案
//        → 擴充加「南屯遙控車」（你的 GitHub 擴充）
//        → 擴充再加官方「藍牙 Bluetooth」（會自動移除無線電）
//        → 專案設定 No Pairing Required
//        → 切 JavaScript 貼上本檔 → 燒錄 micro:bit V2
//
//  ※ 藍牙水電在「專案端」（本檔）處理，不在擴充裡——這樣才編得過。
// ============================================================

let SLOW = 25   // 體驗版速度，很慢（0~100）

// ---- 藍牙水電（專案端）----
nantunCar.prepareCar()                        // 設腳位、顯示 ❌
bluetooth.startUartService()
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)             // 連上 → ✔
})
bluetooth.onBluetoothDisconnected(function () {
    nantunCar.stopCar()                       // 斷線立刻停
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiter.NewLine), function () {
    // 把收到的一行字串交給擴充解析
    nantunCar.handleMessage(bluetooth.uartReadUntil(serial.delimiters(Delimiter.NewLine)))
})

// ---- 駕駛邏輯（純按鈕、慢、只能原地轉）----
basic.forever(function () {
    if (nantunCar.isPressed(nantunCar.Btn.FWD)) {
        nantunCar.setWheels(SLOW, SLOW)        // 前進
    } else if (nantunCar.isPressed(nantunCar.Btn.LEFT)) {
        nantunCar.setWheels(-SLOW, SLOW)       // 原地左轉
    } else if (nantunCar.isPressed(nantunCar.Btn.RIGHT)) {
        nantunCar.setWheels(SLOW, -SLOW)       // 原地右轉
    } else {
        nantunCar.stopCar()
    }
    // 回傳循跡值給 iPad 儀表板
    bluetooth.uartWriteString(nantunCar.reportString("LINE", nantunCar.lineValue()))
    basic.pause(150)
})
