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
//% groups=['起手', '收控制訊號', '車子動作', '感測與回傳']
namespace nantunCar {

    // 下拉選單：按鈕代號（顯示中文，實際送出英文短碼）
    export enum Btn {
        //% block="前進"
        FWD,
        //% block="後退"
        BACK,
        //% block="左"
        LEFT,
        //% block="右"
        RIGHT,
        //% block="油門"
        GO,
        //% block="A"
        A,
        //% block="B"
        B
    }

    function btnCode(b: Btn): string {
        switch (b) {
            case Btn.FWD: return "FWD"
            case Btn.BACK: return "BACK"
            case Btn.LEFT: return "LEFT"
            case Btn.RIGHT: return "RIGHT"
            case Btn.GO: return "GO"
            case Btn.A: return "A"
            default: return "B"
        }
    }

    // ---- 內部狀態 ----
    let started = false
    let connected = false
    let codes: string[] = []      // 收到過的代號
    let vals: number[] = []       // 各代號最新的值

    let pressBtn: Btn[] = [], pressAct: (() => void)[] = []
    let releaseBtn: Btn[] = [], releaseAct: (() => void)[] = []

    function setVal(code: string, v: number) {
        for (let i = 0; i < codes.length; i++) {
            if (codes[i] == code) { vals[i] = v; return }
        }
        codes.push(code); vals.push(v)
    }
    function getVal(code: string): number {
        for (let i = 0; i < codes.length; i++) {
            if (codes[i] == code) return vals[i]
        }
        return 0
    }

    // ---- 馬達差速（內部）----
    function driveWheels(left: number, right: number) {
        left = Math.constrain(left, -100, 100)
        right = Math.constrain(right, -100, 100)
        // 左輪 P8(前) / P14(後)
        if (left >= 0) {
            pins.analogWritePin(AnalogPin.P8, Math.round(Math.map(left, 0, 100, 0, 1023)))
            pins.analogWritePin(AnalogPin.P14, 0)
        } else {
            pins.analogWritePin(AnalogPin.P8, 0)
            pins.analogWritePin(AnalogPin.P14, Math.round(Math.map(-left, 0, 100, 0, 1023)))
        }
        // 右輪 P2(前) / P13(後)
        if (right >= 0) {
            pins.analogWritePin(AnalogPin.P2, Math.round(Math.map(right, 0, 100, 0, 1023)))
            pins.analogWritePin(AnalogPin.P13, 0)
        } else {
            pins.analogWritePin(AnalogPin.P2, 0)
            pins.analogWritePin(AnalogPin.P13, Math.round(Math.map(-right, 0, 100, 0, 1023)))
        }
    }

    // ---- 收訊解析 ----
    function handleLine(line: string) {
        let ci = line.indexOf(":")
        if (ci < 0) return
        let code = line.substr(0, ci)
        let rest = line.substr(ci + 1)
        let comma = rest.indexOf(",")
        if (comma >= 0) {   // 搖桿 x,y → 存成 代號X / 代號Y
            setVal(code + "X", parseFloat(rest.substr(0, comma)))
            setVal(code + "Y", parseFloat(rest.substr(comma + 1)))
            return
        }
        let v = parseFloat(rest)
        let old = getVal(code)
        setVal(code, v)
        if (v == 1 && old != 1) fireBtn(code, true)
        else if (v == 0 && old != 0) fireBtn(code, false)
    }
    function fireBtn(code: string, pressed: boolean) {
        if (pressed) {
            for (let i = 0; i < pressBtn.length; i++)
                if (btnCode(pressBtn[i]) == code) pressAct[i]()
        } else {
            for (let i = 0; i < releaseBtn.length; i++)
                if (btnCode(releaseBtn[i]) == code) releaseAct[i]()
        }
    }

    // ==================== 起手 ====================

    /**
     * 啟動遙控：開啟藍牙、開始接收 iPad 控制台的訊號。放在「當啟動時」。
     */
    //% blockId=nc_start block="啟動遙控自走車"
    //% group="起手" weight=100
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
            for (let i = 0; i < vals.length; i++) vals[i] = 0   // 全部歸零（按鈕視為放開）
            basic.showIcon(IconNames.No)
        })
        bluetooth.onUartDataReceived(serial.delimiters(Delimiter.NewLine), function () {
            handleLine(bluetooth.uartReadUntil(serial.delimiters(Delimiter.NewLine)))
        })
    }

    /**
     * 平板是否已連線。
     */
    //% blockId=nc_connected block="平板已連線?"
    //% group="起手" weight=90
    export function isConnected(): boolean {
        return connected
    }

    // ==================== 收控制訊號 ====================

    /**
     * 當 iPad 上某顆按鈕「被按下」時執行。
     */
    //% blockId=nc_on_press block="當收到按鈕 %b 被按下"
    //% group="收控制訊號" weight=100
    export function onButtonDown(b: Btn, handler: () => void): void {
        pressBtn.push(b); pressAct.push(handler)
    }

    /**
     * 當 iPad 上某顆按鈕「放開」時執行。
     */
    //% blockId=nc_on_release block="當收到按鈕 %b 放開"
    //% group="收控制訊號" weight=95
    export function onButtonUp(b: Btn, handler: () => void): void {
        releaseBtn.push(b); releaseAct.push(handler)
    }

    /**
     * 這顆 iPad 按鈕現在是不是被按住？（可放進「如果」）
     */
    //% blockId=nc_is_pressed block="按鈕 %b 被按下?"
    //% group="收控制訊號" weight=90
    export function isPressed(b: Btn): boolean {
        return getVal(btnCode(b)) == 1
    }

    /**
     * iPad 方向盤／滑桿的最新數值（-100~100，中間 0）。
     */
    //% blockId=nc_steer block="方向盤數值"
    //% group="收控制訊號" weight=80
    export function steerValue(): number {
        return getVal("STEER")
    }

    /**
     * iPad 搖桿左右方向（X）：-100(左) ~ 100(右)。
     */
    //% blockId=nc_joy_x block="搖桿 X"
    //% group="收控制訊號" weight=70
    export function joystickX(): number {
        return getVal("JX")
    }

    /**
     * iPad 搖桿上下方向（Y）：-100(下) ~ 100(上)。
     */
    //% blockId=nc_joy_y block="搖桿 Y"
    //% group="收控制訊號" weight=69
    export function joystickY(): number {
        return getVal("JY")
    }

    // ==================== 車子動作 ====================

    /**
     * 設定左右輪速（各 -100~100，負數=倒轉）。左右不同就會轉彎。
     */
    //% blockId=nc_wheels block="設定左輪 %left 右輪 %right"
    //% left.min=-100 left.max=100 right.min=-100 right.max=100
    //% left.defl=50 right.defl=50
    //% group="車子動作" weight=100
    export function setWheels(left: number, right: number): void {
        driveWheels(left, right)
    }

    /**
     * 停車（左右輪都設 0）。
     */
    //% blockId=nc_stop block="停車"
    //% group="車子動作" weight=90
    export function stopCar(): void {
        driveWheels(0, 0)
    }

    // ==================== 感測與回傳 ====================

    /**
     * 循跡感測值：0~3（P15/P16 兩顆感測器的四種組合）。
     */
    //% blockId=nc_line block="循跡值"
    //% group="感測與回傳" weight=100
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
    //% group="感測與回傳" weight=90
    export function report(code: string, v: number): void {
        if (connected) bluetooth.uartWriteString(code + ":" + v + "\n")
    }
}
