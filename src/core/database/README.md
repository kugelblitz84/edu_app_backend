# Database boundary

Keep ORM configuration, database clients, and migration wiring in this folder.

Do not add a database package until the persistence choice is confirmed. Feature
repositories should depend on domain contracts, while their PostgreSQL/ORM
implementations should live inside each feature's `data` layer.
