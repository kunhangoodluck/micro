/**
 * 南屯遙控車
 * 讓 micro:bit 收 iPad 控制台送來的訊號、驅動 MoonCar 差速馬達、回傳感測值。
 * 積木風格比照 micro:bit 原生輸入（帽子事件 / 六角布林 / 圓角數值）。
 *
 * 對應 iPad 控制台送出的訊號：
 *   按鈕 → 代號:1（按下）／代號:0（放開）
 *   方向盤／滑桿 → 代號:值（-100~100）
 *   搖桿 → 代號:x,y
 * 車回傳 → 代號:數值（例如 LINE:2）
 *
 * 腳位（iCShop MoonCar）：馬達 P2/P8/P13/P14、循跡 P15/P16。
 * 需 micro:bit V2，專案設定 No Pairing Required。
 */
//% weight=100 color=#2b6cb0 icon="\uf1b9" block="南屯遙控車"
namespace nantunCar {

    // 下拉選單：按鈕代號（顯示中文，實際送出英文短碼）
    export enum Btn {
        //% block="前進"
        FWD = 0,
        //% block="後退"
        BACK = 1,
        //% block="左"
        LEFT = 2,
        //% block="右"
        RIGHT = 3,
        //% block="油門"
        GO = 4,
        //% block="A"
        A = 5,
        //% block="B"
        B = 6
    }

    // ---- 內部狀態：每個代號各用一個變數存 ----
    let started = false
    let connected = false

    let vFWD = 0
    let vBACK = 0
    let vLEFT = 0
    let vRIGHT = 0
    let vGO = 0
    let vA = 0
    let vB = 0
    let vSTEER = 0
    let vJX = 0
    let vJY = 0

    // 事件旗標：主程式在迴圈裡自己判斷，不用回呼陣列
    let pressedFWD = false
    let pressedBACK = false
    let pressedLEFT = false
    let pressedRIGHT = false
    let pressedGO = false
    let pressedA = false
    let pressedB = false

    function limit(x: number): number {
        if (x > 100) return 100
        if (x < -100) return -100
        return x
    }

    // 把 0~100 換成 0~1023（自己算，不用 Math.map）
    function toPwm(percent: number): number {
        let p = percent
        if (p < 0) p = 0
        if (p > 100) p = 100
        return Math.idiv(p * 1023, 100)
    }

    // ---- 馬達差速（內部）----
    function driveWheels(left: number, right: number): void {
        left = limit(left)
        right = limit(right)
        // 左輪 P8(前) / P14(後)
        if (left >= 0) {
            pins.analogWritePin(AnalogPin.P8, toPwm(left))
            pins.analogWritePin(AnalogPin.P14, 0)
        } else {
            pins.analogWritePin(AnalogPin.P8, 0)
            pins.analogWritePin(AnalogPin.P14, toPwm(0 - left))
        }
        // 右輪 P2(前) / P13(後)
        if (right >= 0) {
            pins.analogWritePin(AnalogPin.P2, toPwm(right))
            pins.analogWritePin(AnalogPin.P13, 0)
        } else {
            pins.analogWritePin(AnalogPin.P2, 0)
            pins.analogWritePin(AnalogPin.P13, toPwm(0 - right))
        }
    }

    // 把一顆按鈕的值存起來
    function setBtn(code: string, v: number): void {
        let on = (v == 1)
        if (code == "FWD") { vFWD = v; pressedFWD = on }
        else if (code == "BACK") { vBACK = v; pressedBACK = on }
        else if (code == "LEFT") { vLEFT = v; pressedLEFT = on }
        else if (code == "RIGHT") { vRIGHT = v; pressedRIGHT = on }
        else if (code == "GO") { vGO = v; pressedGO = on }
        else if (code == "A") { vA = v; pressedA = on }
        else if (code == "B") { vB = v; pressedB = on }
    }

    // ---- 收訊解析：自己找冒號和逗號，不用 split ----
    function handleLine(line: string): void {
        let colon = line.indexOf(":")
        if (colon < 0) return
        let code = line.substr(0, colon)
        let rest = line.substr(colon + 1, line.length - colon - 1)

        let comma = rest.indexOf(",")
        if (comma >= 0) {
            let sx = rest.substr(0, comma)
            let sy = rest.substr(comma + 1, rest.length - comma - 1)
            vJX = parseFloat(sx)
            vJY = parseFloat(sy)
            return
        }

        let v = parseFloat(rest)
        if (code == "STEER") vSTEER = v
        else setBtn(code, v)
    }

    // ==================== 起手 ====================

    /**
     * 啟動遙控：開啟藍牙、開始接收 iPad 控制台的訊號。放在「當啟動時」。
     */
    //% blockId=nc_start block="啟動遙控自走車"
    //% weight=100
    export function startRemote(): void {
        if (started) return
        started = true
        basic.showIcon(IconNames.No)
        pins.setPull(DigitalPin.P15, PinPullMode.PullNone)
        pins.setPull(DigitalPin.P16, PinPullMode.PullNone)
        bluetooth.startUartService()
        bluetooth.onBluetoothConnected(function () {
            connected = true
            basic.showIcon(IconNames.Yes)
        })
        bluetooth.onBluetoothDisconnected(function () {
            connected = false
            driveWheels(0, 0)
            vFWD = 0; vBACK = 0; vLEFT = 0; vRIGHT = 0; vGO = 0; vA = 0; vB = 0; vSTEER = 0; vJX = 0; vJY = 0
            pressedFWD = false; pressedBACK = false; pressedLEFT = false; pressedRIGHT = false; pressedGO = false; pressedA = false; pressedB = false
            basic.showIcon(IconNames.No)
        })
        bluetooth.onUartDataReceived(serial.delimiters(Delimiter.NewLine), function () {
            let line = bluetooth.uartReadUntil(serial.delimiters(Delimiter.NewLine))
            handleLine(line)
        })
    }

    /**
     * 平板是否已連線。
     */
    //% blockId=nc_connected block="平板已連線?"
    //% weight=90
    export function isConnected(): boolean {
        return connected
    }

    // ==================== 收控制訊號 ====================

    /**
     * 這顆 iPad 按鈕現在是不是被按住？（可放進「如果」或「重複無限次」裡判斷）
     */
    //% blockId=nc_is_pressed block="按鈕 %b 被按下?"
    //% weight=80
    export function isPressed(b: Btn): boolean {
        if (b == Btn.FWD) return pressedFWD
        if (b == Btn.BACK) return pressedBACK
        if (b == Btn.LEFT) return pressedLEFT
        if (b == Btn.RIGHT) return pressedRIGHT
        if (b == Btn.GO) return pressedGO
        if (b == Btn.A) return pressedA
        return pressedB
    }

    /**
     * iPad 方向盤／滑桿的最新數值（-100~100，中間 0）。
     */
    //% blockId=nc_steer block="方向盤數值"
    //% weight=70
    export function steerValue(): number {
        return vSTEER
    }

    /**
     * iPad 搖桿左右方向（X）：-100(左) ~ 100(右)。
     */
    //% blockId=nc_joy_x block="搖桿 X"
    //% weight=69
    export function joystickX(): number {
        return vJX
    }

    /**
     * iPad 搖桿上下方向（Y）：-100(下) ~ 100(上)。
     */
    //% blockId=nc_joy_y block="搖桿 Y"
    //% weight=68
    export function joystickY(): number {
        return vJY
    }

    // ==================== 車子動作 ====================

    /**
     * 設定左右輪速（各 -100~100，負數=倒轉）。左右不同就會轉彎。
     */
    //% blockId=nc_wheels block="設定左輪 %left 右輪 %right"
    //% left.min=-100 left.max=100 right.min=-100 right.max=100
    //% left.defl=50 right.defl=50
    //% weight=60
    export function setWheels(left: number, right: number): void {
        driveWheels(left, right)
    }

    /**
     * 停車（左右輪都設 0）。
     */
    //% blockId=nc_stop block="停車"
    //% weight=59
    export function stopCar(): void {
        driveWheels(0, 0)
    }

    // ==================== 感測與回傳 ====================

    /**
     * 循跡感測值：0~3（P15/P16 兩顆感測器的四種組合）。
     */
    //% blockId=nc_line block="循跡值"
    //% weight=50
    export function lineValue(): number {
        let a = pins.digitalReadPin(DigitalPin.P15)
        let b = pins.digitalReadPin(DigitalPin.P16)
        if (a == 1 && b == 1) return 0
        if (a == 1 && b == 0) return 1
        if (a == 0 && b == 1) return 2
        return 3
    }

    /**
     * 回傳一個數值給 iPad 儀表板（例如 代號 LINE、數值 循跡值）。
     */
    //% blockId=nc_report block="回傳 %code 數值 %v 給平板"
    //% weight=49
    export function report(code: string, v: number): void {
        if (connected) bluetooth.uartWriteString("" + code + ":" + v + "\n")
    }
}
