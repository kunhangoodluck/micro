/**
 * 南屯遙控車（不含藍牙版）
 * 只負責「車的大腦」：解析收到的訊號、驅動 MoonCar 差速馬達、讀循跡。
 * 藍牙由「專案端」用官方藍牙擴充處理，把收到的字串餵進「處理收到訊號」。
 *
 * 訊號格式：
 *   按鈕 → 代號:1（按下）／代號:0（放開）
 *   方向盤／滑桿 → STEER:值（-100~100）
 *   搖桿 → J:x,y
 * 腳位（iCShop MoonCar）：馬達 P2/P8/P13/P14、循跡 P15/P16。
 */
//% weight=100 color=#2b6cb0 icon="\uf1b9" block="南屯遙控車"
namespace nantunCar {

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

    let vSTEER = 0
    let vJX = 0
    let vJY = 0
    let pFWD = false
    let pBACK = false
    let pLEFT = false
    let pRIGHT = false
    let pGO = false
    let pA = false
    let pB = false

    // ---- 馬達差速（比照 MoonCar 寫法）----
    function moveMotor(a: number, b: number, c: number, d: number): void {
        pins.analogWritePin(AnalogPin.P8, a)
        pins.analogWritePin(AnalogPin.P14, b)
        pins.analogWritePin(AnalogPin.P2, c)
        pins.analogWritePin(AnalogPin.P13, d)
    }

    /**
     * 準備自走車（設定循跡腳位、顯示 ❌ 等待連線）。放在「當啟動時」。
     */
    //% blockId=nc_prepare block="準備自走車"
    //% weight=100
    export function prepareCar(): void {
        pins.setPull(DigitalPin.P15, PinPullMode.PullNone)
        pins.setPull(DigitalPin.P16, PinPullMode.PullNone)
        basic.showIcon(IconNames.No)
    }

    /**
     * 設定左右輪速（各 -100~100，負數=倒轉）。左右不同就會轉彎。
     */
    //% blockId=nc_wheels block="設定左輪 %left 右輪 %right"
    //% left.min=-100 left.max=100 right.min=-100 right.max=100
    //% left.defl=50 right.defl=50
    //% weight=90
    export function setWheels(left: number, right: number): void {
        if (left > 100) left = 100
        if (left < -100) left = -100
        if (right > 100) right = 100
        if (right < -100) right = -100

        let la = 0
        let lb = 0
        if (left >= 0) { la = Math.round(Math.map(left, 0, 100, 0, 1023)); lb = 0 }
        else { la = 0; lb = Math.round(Math.map(0 - left, 0, 100, 0, 1023)) }

        let ra = 0
        let rb = 0
        if (right >= 0) { ra = Math.round(Math.map(right, 0, 100, 0, 1023)); rb = 0 }
        else { ra = 0; rb = Math.round(Math.map(0 - right, 0, 100, 0, 1023)) }

        moveMotor(la, lb, ra, rb)
    }

    /**
     * 停車（左右輪都設 0）。
     */
    //% blockId=nc_stop block="停車"
    //% weight=89
    export function stopCar(): void {
        moveMotor(0, 0, 0, 0)
    }

    /**
     * 處理一則收到的訊號（把藍牙收到的字串餵進來）。
     */
    //% blockId=nc_handle block="處理收到訊號 %text"
    //% weight=80
    export function handleMessage(text: string): void {
        let colon = text.indexOf(":")
        if (colon < 0) return
        let code = text.substr(0, colon)
        let rest = text.substr(colon + 1, text.length - colon - 1)

        let comma = rest.indexOf(",")
        if (comma >= 0) {
            vJX = parseFloat(rest.substr(0, comma))
            vJY = parseFloat(rest.substr(comma + 1, rest.length - comma - 1))
            return
        }

        let v = parseFloat(rest)
        let on = (v == 1)
        if (code == "STEER") vSTEER = v
        else if (code == "FWD") pFWD = on
        else if (code == "BACK") pBACK = on
        else if (code == "LEFT") pLEFT = on
        else if (code == "RIGHT") pRIGHT = on
        else if (code == "GO") pGO = on
        else if (code == "A") pA = on
        else if (code == "B") pB = on
    }

    /**
     * 這顆 iPad 按鈕現在是不是被按住？（放進「如果」或「重複無限次」判斷）
     */
    //% blockId=nc_pressed block="按鈕 %b 被按下?"
    //% weight=70
    export function isPressed(b: Btn): boolean {
        if (b == Btn.FWD) return pFWD
        if (b == Btn.BACK) return pBACK
        if (b == Btn.LEFT) return pLEFT
        if (b == Btn.RIGHT) return pRIGHT
        if (b == Btn.GO) return pGO
        if (b == Btn.A) return pA
        return pB
    }

    /**
     * iPad 方向盤／滑桿的最新數值（-100~100，中間 0）。
     */
    //% blockId=nc_steer block="方向盤數值"
    //% weight=60
    export function steerValue(): number {
        return vSTEER
    }

    /**
     * iPad 搖桿左右（X）：-100(左) ~ 100(右)。
     */
    //% blockId=nc_jx block="搖桿 X"
    //% weight=59
    export function joystickX(): number {
        return vJX
    }

    /**
     * iPad 搖桿上下（Y）：-100(下) ~ 100(上)。
     */
    //% blockId=nc_jy block="搖桿 Y"
    //% weight=58
    export function joystickY(): number {
        return vJY
    }

    /**
     * 循跡感測值：0~3。
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
     * 組出要回傳給 iPad 的訊息（例如 代號 LINE、數值 循跡值），再用藍牙送出。
     */
    //% blockId=nc_reportstr block="要回傳的訊息 代號 %code 數值 %v"
    //% weight=40
    export function reportString(code: string, v: number): string {
        return "" + code + ":" + v + "\n"
    }
}
