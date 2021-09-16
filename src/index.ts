import {
    QMainWindow,
    QWidget,
    QLabel,
    FlexLayout,
    QPushButton,
    QIcon,
    QStackedWidget,
    QSystemTrayIcon,
    QMenu,
    QAction,
    QApplication,
    QScrollArea,
    QLineEdit,
    EchoMode,
    QPixmap,
    QCheckBox,
    QGridLayout,
} from '@nodegui/nodegui'

import logo from '../assets/logox200.png'
import loginLogo from '../assets/logo.png'
import { dataCallback, OAuth } from 'oauth'
const notifier = require('node-notifier')
const open = require('open')
const path = require('path')
import { consumerKey, consumerSecret, info } from './key'

// --------------------------------------------------------
// --------------------------------------------------------
// --------------------------------------------------------
// --------------------------------------------------------

interface UserData {
    id: number
    display_name: string
}

interface UserUI extends UserData {
    selected: QCheckBox
    layout: FlexLayout
    widget: QWidget
}

var api_root_uri = 'https://www.plurk.com'
var oauth_access_token: string = ''
var oauth_access_token_secret: string = ''
var id: string
var isLogin: boolean = false
var UserUIArray: Array<UserUI> = []
var NotifTarget = new Map()
var parsedPlurk: Array<string> = []

var oa = new OAuth(
    'https://www.plurk.com/OAuth/request_token',
    'https://www.plurk.com/OAuth/access_token',
    consumerKey,
    consumerSecret,
    '1.0',
    null,
    'HMAC-SHA1'
)

function callAPI(path: string, params: object, callback: dataCallback) {
    oa.post(
        path,
        oauth_access_token,
        oauth_access_token_secret,
        params,
        'application/json',
        callback
    )
}

function requestTokenCallback(
    error: object,
    oauth_token: string,
    oauth_token_secret: string,
    results: object
) {
    if (error) console.log('error :' + error)
    else {
        console.log('oauth_token :' + oauth_token)
        console.log('oauth_token_secret :' + oauth_token_secret)
        oauth_access_token = oauth_token
        oauth_access_token_secret = oauth_token_secret
        console.log('request token results :')
        console.log(results)
        console.log('require user authorize')
        console.log(
            'go to https://www.plurk.com/OAuth/authorize?oauth_token=' +
                oauth_token
        )
        open(
            'https://www.plurk.com/OAuth/authorize?oauth_token=' + oauth_token,
            { wait: false }
        )
    }
}

function accessTokenCallback(
    error: object,
    access_token: string,
    access_token_secret: string,
    results: object
) {
    if (error) {
        console.log('error: ' + JSON.stringify(error))
    } else {
        console.log('oauth_access_token :' + access_token)
        console.log('oauth_token_secret :' + access_token_secret)
        oauth_access_token = access_token
        oauth_access_token_secret = access_token_secret
        console.log('accesstoken results :')
        console.log(results)
        console.log('Requesting access token')
        callAPI(api_root_uri + '/APP/Users/me', {}, loginInit)
    }
}

// --------------------------------------------------------
// --------------------------------------------------------
// --------------------------------------------------------
// --------------------------------------------------------

const win = new QMainWindow()
win.setWindowTitle('噗通知')
win.setMinimumSize(300, 600)

// -------------------------------------------------------- //
//                     Login Page                           //
// -------------------------------------------------------- //
var loginIcon = new QPixmap(loginLogo)
loginIcon = loginIcon.scaled(300, 300, 1)

const loginPage = new QWidget()
const loginLogoHolder = new QLabel()
loginLogoHolder.setPixmap(loginIcon)
const oauthCode = new QLineEdit()
oauthCode.setStyleSheet('text-align:center;')
oauthCode.setPlaceholderText('在此輸入驗證碼')
oauthCode.setEchoMode(EchoMode.Normal)
oauthCode.addEventListener('returnPressed', () => {
    onBtnClick('sendLogin')
})

const openAuthpageButton = new QPushButton()
openAuthpageButton.setText('前往授權頁面取得驗證碼')
openAuthpageButton.addEventListener('clicked', () => {
    onBtnClick('openAuthpage')
})

const loginButton = new QPushButton()
loginButton.setText('登入')
loginButton.addEventListener('clicked', () => {
    onBtnClick('sendLogin')
})

const loginLayout = new FlexLayout()
loginPage.setLayout(loginLayout)
loginLayout.addWidget(loginLogoHolder)
loginLayout.addWidget(openAuthpageButton)
loginLayout.addWidget(oauthCode)
loginLayout.addWidget(loginButton)

// -------------------------------------------------------- //
//                     Main Page                            //
// -------------------------------------------------------- //
var notifOn: boolean = false
var notifIntervalId: NodeJS.Timeout

const getUserButton = new QPushButton()
getUserButton.setText('取得好友列表')
getUserButton.addEventListener('clicked', () => {
    onBtnClick('getFriendList')
})
const startNotifButton = new QPushButton()
startNotifButton.setText('開啟通知')
startNotifButton.addEventListener('clicked', () => {
    onBtnClick('startStopNotif')
})

const mainPage = new QWidget()
var userListContainer = new QWidget()
userListContainer.setLayout(new QGridLayout())
const mainScrollArea = new QScrollArea()
const mainLayout = new QGridLayout()
mainPage.setLayout(mainLayout)
mainLayout.addWidget(getUserButton, 0, 0)
mainLayout.addWidget(mainScrollArea, 1, 0)
mainLayout.addWidget(startNotifButton, 2, 0)

// -------------------------------------------------------- //
//                     Switch Page                          //
// -------------------------------------------------------- //

const stacked = new QStackedWidget()
stacked.addWidget(loginPage)
stacked.addWidget(mainPage)
const appInfo = new QLabel()
appInfo.setText(info)
appInfo.setAlignment(2)
const centralWidget = new QWidget()
const rootLayout = new QGridLayout()
centralWidget.setLayout(rootLayout)
rootLayout.addWidget(stacked, 0, 0)
rootLayout.addWidget(appInfo, 1, 0)

// -------------------------------------------------------- //
//                     System Tray                          //
// -------------------------------------------------------- //

const tray = new QSystemTrayIcon()
tray.setIcon(new QIcon(logo))
tray.show()
const menu = new QMenu()
tray.setContextMenu(menu)

// -------------------
// Quit Action
// -------------------
const quitAction = new QAction()
quitAction.setText('結束 噗通知')
quitAction.addEventListener('triggered', () => {
    const app = QApplication.instance()
    app.exit(0)
})

// ----------------
// Dock Show
// ----------------
const showAction = new QAction()
showAction.setText('縮小/還原視窗')
showAction.addEventListener('triggered', () => {
    if (win.isVisible()) {
        win.hide()
    } else {
        win.show()
    }
})

// ----------------------
// Add everything to menu
// ----------------------
menu.addAction(showAction)
menu.addAction(quitAction)

var onBtnClick = (value: string) => {
    console.log(value)
    if (value == 'openAuthpage') {
        oa.getOAuthRequestToken(requestTokenCallback)
    }
    if (value == 'sendLogin') {
        oa.getOAuthAccessToken(
            oauth_access_token,
            oauth_access_token_secret,
            oauthCode.text(),
            accessTokenCallback
        )
        stacked.setCurrentWidget(mainPage)
    }
    if (value == 'getFriendList') {
        userListContainer = new QWidget()
        userListContainer.setLayout(new QGridLayout())
        callAPI(
            api_root_uri + '/APP/FriendsFans/getFriendsByOffset',
            { user_id: id, limit: '100000', minimal_data: 'true' },
            parseUser
        )
    }
    if (value == 'startStopNotif') {
        if (notifOn == true) {
            clearInterval(notifIntervalId)
            startNotifButton.setText('開始通知')
            notifOn = false
        } else {
            notifOn = true
            startNotifButton.setText('停止通知')
            var currentTimeStamp = new Date().toISOString()
            NotifTarget.clear()
            UserUIArray.forEach((user) => {
                if (user.selected.isChecked()) {
                    NotifTarget.set(user.id, user.display_name)
                }
            })
            notifIntervalId = setInterval(function () {
                callAPI(
                    api_root_uri + '/APP/Polling/getPlurks',
                    { offset: currentTimeStamp },
                    parseNotif
                )
            }, 3000)
        }
    }
}

var loginInit = function (
    err: { statusCode: number; data?: any },
    result: string | Buffer | undefined
) {
    if (err) {
        console.log(err)
        console.log('Obtain user error! Exit process.')
    } else if (typeof result == 'string') {
        var data = JSON.parse(result)
        id = data['id']
    }
}

var parseNotif = function (
    err: { statusCode: number; data?: any },
    result: string | Buffer | undefined
) {
    console.log('Start parse notif')
    if (err) {
        console.log(err)
        console.log('Obtain user error! Exit process.')
    } else if (typeof result == 'string') {
        var data = JSON.parse(result)
        data['plurks'].forEach((plurk: any) => {
            for (var [id, name] of NotifTarget) {
                if (
                    String(id) == plurk['owner_id'] &&
                    false == parsedPlurk.includes(String([plurk['plurk_id']]))
                ) {
                    if (parsedPlurk.push(String(plurk['plurk_id'])) >= 20) {
                        parsedPlurk.shift()
                    }
                    var dateString = new Date(Date.now()).toUTCString()
                    console.log(dateString + '  ' + name + ' 發新噗囉!')
                    console.log(
                        'https://www.plurk.com/p/' +
                            parseInt(plurk['plurk_id'], 10).toString(36)
                    )
                    notifier.notify(
                        {
                            title: '噗通知',
                            message: dateString + '  ' + name + ' 發新噗囉!',
                            icon: path.join(__dirname, '../assets/logo.png'),
                        },
                        function (err: Error, action: String) {
                            if (action == 'activate') {
                                open(
                                    'https://www.plurk.com/p/' +
                                        parseInt(
                                            plurk['plurk_id'],
                                            10
                                        ).toString(36)
                                )
                            }
                        }
                    )
                }
            }
        })
    }
}

var parseUser = function (
    err: { statusCode: number; data?: any },
    result: string | Buffer | undefined
) {
    if (err) {
        console.log(err)
        console.log('Obtain user error! Exit process.')
    } else if (typeof result == 'string') {
        var data: Array<UserData> = JSON.parse(result)
        data.forEach((user: UserData) => {
            var tmpCheckBox = new QCheckBox()
            tmpCheckBox.setText(user['display_name'].padEnd(15, '　'))
            UserUIArray.push({
                id: user['id'],
                display_name: user['display_name'],
                selected: tmpCheckBox,
                layout: new FlexLayout(),
                widget: new QWidget(),
            })
        })
        renderUser()
    }
}

var renderUser = function () {
    for (var i: number = 0; i < UserUIArray.length; i++) {
        userListContainer.layout!.addWidget(UserUIArray[i].selected, i, 0)
    }
    mainScrollArea.setWidget(userListContainer)
}

win.setCentralWidget(centralWidget)
win.show()

const qApp = QApplication.instance()
qApp.setQuitOnLastWindowClosed(false) // required so that app doesnt close if we close all windows.
;(global as any).win = win // To prevent win from being garbage collected.
;(global as any).systemTray = tray // To prevent system tray from being garbage collected.
