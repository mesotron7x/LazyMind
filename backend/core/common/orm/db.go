package orm

import (
	"fmt"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"lazymind/core/log"
)

// DB text *gorm.DB，text ACL text。text PostgreSQL、SQLite、MySQL。
type DB struct {
	*gorm.DB
}

// Connect text
const (
	DriverPostgres = "postgres"
	DriverSQLite   = "sqlite"
	DriverMySQL    = "mysql"
)

// Connect text。driver: postgres / sqlite / mysql，dsn text。
func Connect(driver, dsn string) (*DB, error) {
	var dialector gorm.Dialector
	switch driver {
	case DriverPostgres:
		dialector = postgres.Open(dsn)
	case DriverSQLite:
		dialector = sqlite.Open(dsn)
	case DriverMySQL:
		dialector = mysql.Open(dsn)
	default:
		return nil, fmt.Errorf("unsupported driver: %s (use postgres, sqlite, mysql)", driver)
	}
	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if driver == DriverSQLite {
		if err := configureSQLite(db); err != nil {
			return nil, fmt.Errorf("configure sqlite pragmas: %w", err)
		}
	}
	return &DB{DB: db}, nil
}

// MustConnect text，Failedtext Fatal Logtext，text main text。
func MustConnect(driver, dsn string) *DB {
	db, err := Connect(driver, dsn)
	if err != nil {
		log.Logger.Fatal().Err(err).Str("driver", driver).Msg("orm: connect failed")
	}
	return db
}

func configureSQLite(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA foreign_keys=ON",
		"PRAGMA synchronous=NORMAL",
	}
	for _, p := range pragmas {
		if _, err := sqlDB.Exec(p); err != nil {
			return fmt.Errorf("%s: %w", p, err)
		}
	}
	return nil
}
