import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import AnalyticsPage from '../pages/AnalyticsPage'
import DetailPage from '../pages/DetailPage'
import EditUserPage from '../pages/EditUserPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import SignInPage from '../pages/SignInPage'
import SignUpPage from '../pages/SignUpPage'
import UserManagementPage from '../pages/UserManagementPage'
import RequireAuth from './RequireAuth'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            element: <DetailPage />,
          },
          {
            path: 'users',
            element: <UserManagementPage />,
          },
          {
            path: 'users/:id/edit',
            element: <EditUserPage />,
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
          },
        ],
      },
      {
        path: 'signin',
        element: <SignInPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'signup',
        element: <SignUpPage />,
      },
    ],
  },
])

export default router
