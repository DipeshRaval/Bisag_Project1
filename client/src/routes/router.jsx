import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import DetailPage from '../pages/DetailPage'
import SignInPage from '../pages/SignInPage'
import SignUpPage from '../pages/SignUpPage'
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
        ],
      },
      {
        path: 'signin',
        element: <SignInPage />,
      },
      {
        path: 'signup',
        element: <SignUpPage />,
      },
    ],
  },
])

export default router
