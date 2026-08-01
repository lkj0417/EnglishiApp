package server

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(authService service.AuthService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			response.Fail(c, http.StatusUnauthorized, 20010, "missing bearer token")
			c.Abort()
			return
		}
		tokenString := strings.TrimPrefix(header, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			response.Fail(c, http.StatusUnauthorized, 20011, "invalid token")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, 20012, "invalid token claims")
			c.Abort()
			return
		}
		sub, ok := claims["sub"].(string)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, 20013, "missing token subject")
			c.Abort()
			return
		}
		userID, err := strconv.ParseUint(sub, 10, 64)
		if err != nil || userID == 0 {
			response.Fail(c, http.StatusUnauthorized, 20014, "invalid token subject")
			c.Abort()
			return
		}
		if err := authService.ValidateSession(c.Request.Context(), tokenString, userID); err != nil {
			response.Fail(c, http.StatusUnauthorized, 20015, err.Error())
			c.Abort()
			return
		}
		c.Set("userId", userID)
		c.Next()
	}
}

