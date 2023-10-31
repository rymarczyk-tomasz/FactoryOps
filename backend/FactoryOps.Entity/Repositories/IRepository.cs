using FactoryOps.Entity.Models;

namespace FactoryOps.Entity.Repositories;

public interface IRepository<T> where T : BaseEntity
{
	Task<T?> Get(string id);
	IAsyncEnumerable<T> GetAll();
	IQueryable<T> GetAllQueryable();
	Task Insert(T entity);
	Task Update(T entity);
	Task Delete(T entity);
}
