import type { Qwe } from '@/types/bot'
import instance from '@/utils/request'

export const qwe = () => {
    return instance.get<Qwe>('bbot/index/')
}

// export const loginApi = (data: LoginParams) => {
//     return instance.post<LoginResponse<UserInfo>>('/user/login/', data)
// }

// export const refreshTokenApi = () => {
//     return instance.post<RefreshTokenResponse>('/user/refresh_token/')
// }

// export const getUserListApi = (data: UserListParams) => {
//     return instance.get<UserListResponse<UserListData[]>>('/user/user_list/', {
//         params: data,
//     })
// }
