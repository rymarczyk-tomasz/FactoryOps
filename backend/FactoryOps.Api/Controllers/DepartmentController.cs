using FactoryOps.Entity.Repositories;
using FactoryOps.Entity.Models;
using Microsoft.AspNetCore.Mvc;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("departments")]
public class DepartmentController : ControllerBase
{
	private readonly IRepository<Department> departmentRepository;
	public DepartmentController(IRepository<Department> departmentRepository)
	{
		this.departmentRepository = departmentRepository;
	}

	[HttpGet]
	public ActionResult<IAsyncEnumerable<Department>> GetWorkItems() => Ok(this.departmentRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Department>> GetWorkItem(string id) => Ok(await this.departmentRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Department department)
	{
		await this.departmentRepository.Insert(department);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] Department department)
	{
		await this.departmentRepository.Update(department);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Department department)
	{
		await this.departmentRepository.Delete(department);
		return Ok();
	}

}
