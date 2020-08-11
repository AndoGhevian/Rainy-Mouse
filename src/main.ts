import * as path from 'path'
import * as fs from 'fs'
import iohook from 'iohook'

import { app, BrowserWindow, screen, Tray, Menu, ipcMain } from 'electron'

app.allowRendererProcessReuse = true

const mainWinPath = path.join(__dirname, '../app', 'index.html')
const aboutWinPath = path.join(__dirname, '../app', 'about.html')

const iconPath = path.join(__dirname, '../app', 'assets', 'icons', 'icon.png')

let win: BrowserWindow | null, aboutWin: BrowserWindow | null
async function createMainWindow() {
    const currentWin = new BrowserWindow({
        width: 124,
        height: 124,
        hasShadow: false,
        transparent: true,
        frame: false,
        focusable: false,
        title: 'Password Manager',
    })
    currentWin.setIgnoreMouseEvents(true, { forward: true })
    win = currentWin

    await currentWin.loadFile(mainWinPath)
    return currentWin
}

function createAboutWindow() {
    const currentAboutWin = new BrowserWindow({
        width: 720,
        height: 140,
        title: 'Rainy Mouse',
        frame: false,
        transparent: true,
        focusable: false,
        // backgroundColor: 'white',

        webPreferences: {
            nodeIntegration: true
        }
    })
    aboutWin = currentAboutWin
    currentAboutWin.loadFile(aboutWinPath)
    return currentAboutWin
}

async function initialization(delay: number) {
    const tray = new Tray(iconPath)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Quit',
            click: () => {
                iohook.stop()
                aboutWin = null
                win = null
                app.quit()
            },
        },
        {
            label: 'About',
            click: async () => {
                if (!aboutWin) {
                    const currentAboutWin = createAboutWindow()
                    const readyHandler = () => {
                        ipcMain.off('about:ready', readyHandler)
                        if (currentAboutWin === aboutWin) {
                            currentAboutWin.webContents.send('show')
                        }
                    }
                    const hideHandler = () => {
                        ipcMain.off('about:ready', readyHandler)
                        ipcMain.off('about:ready-hide', hideHandler)
                        if (currentAboutWin === aboutWin) {
                            currentAboutWin.hide()
                            aboutWin = null
                        }
                    }
                    ipcMain.on('about:ready', readyHandler)
                    ipcMain.on('about:ready-hide', hideHandler)
                    return
                }
                aboutWin.focus()
            }
        }
    ])
    tray.setToolTip('Rainy Mouse')
    tray.setContextMenu(contextMenu)

    let tId: NodeJS.Timeout
    const currentAboutWin = createAboutWindow()
    const readyHandler = () => {
        if (currentAboutWin === aboutWin) {
            currentAboutWin.webContents.send('show')
        }
        ipcMain.off('about:ready', readyHandler)
    }
    const showHandler = () => {
        if (currentAboutWin === aboutWin) {
            tId = setTimeout(() => {
                if (currentAboutWin === aboutWin) {
                    currentAboutWin.webContents.send('hide')
                }
            }, delay)
        }
        ipcMain.off('about:ready-show', showHandler)
    }
    ipcMain.on('about:ready', readyHandler)
    ipcMain.on('about:ready-show', showHandler)

    return new Promise((res, rej) => {
        const hideHandler = () => {
            if (currentAboutWin === aboutWin) {
                currentAboutWin.hide()
                aboutWin = null
            }
            clearTimeout(tId)
            ipcMain.off('about:ready', readyHandler)
            ipcMain.off('about:ready-show', showHandler)
            ipcMain.off('about:ready-hide', hideHandler)
            res()
        }
        ipcMain.on('about:ready-hide', hideHandler)
    })

}

/**
 * Runs Electron app.
 * @param delay Delay before open window to correctly initialize GPU for trancparent window. Recomended values starting from `500`.
 * @defaultValue `1000`
 */
async function run(delay = 1000) {
    await app.whenReady()
    await new Promise((res) => setTimeout(res, delay))
    iohook.on('mouseclick', event => {
        if (aboutWin) {
            const currentAboutWin = aboutWin
            const bounds = aboutWin.getBounds()
            if (!pointInRect(event, bounds)) {
                currentAboutWin.webContents.send('hide')
            }
        }
    });
    iohook.start();
    await initialization(1000)

    await createMainWindow()

    const { x: initialX, y: initialY } = screen.getCursorScreenPoint()
    win!.setPosition(initialX - 45, initialY - 70)

    iohook.on('mousemove', event => {
        win!.setPosition(event.x - 45, event.y - 70)
    });
    iohook.on('mousedrag', event => {
        win!.setPosition(event.x - 45, event.y - 70)
    });
}

// Listeners
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
    }
})

app.on('ready', () => run())

const pointInRect = (point: { x: number, y: number }, rect: { x: number, y: number, width: number, height: number }) => {
    if ((point.x > rect.x && point.x < rect.x + rect.width) && (point.y > rect.y && point.y < rect.y + rect.height)) return true
    return false
}